// Prefills the composer for replies and forwards, and builds the quoted original the way
// Gmail does, so Gmail folds it away for the person reading your reply.
import { escapeHtml, sanitizeFragment, textToHtml } from './html.js'
import { quoteDate, nameOf } from './format.js'
import { formatAddress, sameEmail, uniqueAddresses } from './address.js'

const prefixed = (subject, prefix) => {
  const clean = (subject || '').trim()
  if (!clean) return prefix === 'Re' ? 'Re:' : 'Fwd:'
  const re = prefix === 'Re' ? /^(re|aw|sv)\s*:/i : /^(fwd?|wg)\s*:/i
  return re.test(clean) ? clean : `${prefix}: ${clean}`
}

// Large inline images make quoted replies heavy, so they are left out of the quote
function lightHtml(message) {
  const source = message.html?.trim() ? message.html : textToHtml(message.text || '')
  return source.replace(/<img[^>]+src=["']data:[^"']{60000,}["'][^>]*>/gi, '')
}

function bodyOnly(html) {
  const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)
  return match ? match[1] : html
}

export function quoteBlock(message) {
  const who = message.from ? `${escapeHtml(nameOf(message.from))} &lt;${escapeHtml(message.from.email)}&gt;` : 'someone'
  return (
    `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">On ${escapeHtml(quoteDate(message.date))} ${who} wrote:<br></div>` +
    `<blockquote class="gmail_quote" style="margin:0px 0px 0px 0.8ex;border-left:1px solid rgb(204,204,204);padding-left:1ex">` +
    `${sanitizeFragment(bodyOnly(lightHtml(message)))}</blockquote></div>`
  )
}

export function forwardBlock(message) {
  const line = (label, value) => (value ? `${label}: ${value}<br>` : '')
  const list = (items) => items.map((a) => escapeHtml(formatAddress(a))).join(', ')
  return (
    `<div class="gmail_quote"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>` +
    line('From', message.from ? `<strong class="gmail_sendername" dir="auto">${escapeHtml(nameOf(message.from))}</strong> <span dir="auto">&lt;${escapeHtml(message.from.email)}&gt;</span>` : '') +
    line('Date', escapeHtml(quoteDate(message.date))) +
    line('Subject', escapeHtml(message.subject || '')) +
    line('To', list(message.to || [])) +
    line('Cc', list(message.cc || [])) +
    `<br></div><br>${sanitizeFragment(bodyOnly(lightHtml(message)))}</div>`
  )
}

const quotedText = (message) => {
  const original = (message.text || '').trim() || ''
  const head = `On ${quoteDate(message.date)} ${message.from ? `${nameOf(message.from)} <${message.from.email}>` : 'someone'} wrote:`
  return `${head}\n${original.split('\n').map((l) => `> ${l}`).join('\n')}`
}

// mode: 'reply' | 'replyAll' | 'forward'
export function draftFor(mode, message, thread, self) {
  const mine = (a) => self.some((e) => sameEmail(e, a.email))
  const references = [message.references, message.messageId].filter(Boolean).join(' ').trim() || null
  const base = {
    mode,
    threadId: thread.id,
    inReplyTo: message.messageId || null,
    references,
    quoteHtml: mode === 'forward' ? forwardBlock(message) : quoteBlock(message),
    quoteText: mode === 'forward' ? `---------- Forwarded message ---------\nFrom: ${formatAddress(message.from)}\nSubject: ${message.subject}\n\n${message.text || ''}` : quotedText(message),
    replyingTo: message.id,
  }
  if (mode === 'forward') {
    return {
      ...base,
      inReplyTo: null,
      references: null,
      to: [],
      cc: [],
      bcc: [],
      subject: prefixed(message.subject || thread.subject, 'Fwd'),
      forwardAttachments: (message.attachments || [])
        .filter((a) => !a.inline && a.id)
        .map((a) => ({ messageId: message.id, attachmentId: a.id, filename: a.filename, mimeType: a.mimeType, size: a.size })),
    }
  }
  const replyTarget = message.replyTo?.length ? message.replyTo : message.from ? [message.from] : []
  let to = message.fromMe ? message.to || [] : replyTarget
  let cc = []
  if (mode === 'replyAll') {
    to = uniqueAddresses([...to, ...(message.fromMe ? [] : message.to || [])].filter((a) => !mine(a)))
    cc = uniqueAddresses((message.cc || []).filter((a) => !mine(a)), to.map((a) => a.email))
  }
  return {
    ...base,
    to: uniqueAddresses(to.filter((a) => !mine(a) || message.fromMe)),
    cc,
    bcc: [],
    subject: prefixed(message.subject || thread.subject, 'Re'),
    forwardAttachments: [],
  }
}

// Whether Reply all would add anyone beyond plain Reply
export function hasOthers(message, self) {
  const mine = (a) => self.some((e) => sameEmail(e, a.email))
  const people = [...(message.to || []), ...(message.cc || [])].filter((a) => !mine(a))
  const sender = message.from && !mine(message.from) ? [message.from] : []
  return uniqueAddresses([...sender, ...people]).length > 1
}
