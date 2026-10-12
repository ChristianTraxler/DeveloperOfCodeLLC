// Turns Gmail API resources into the compact shapes the Mail page uses.
import { b64urlDecode, b64urlToB64 } from './base64.ts'
import type { GmailMessage, GmailPart, GmailThread } from './gmail.ts'

export type Address = { name: string; email: string }

export type ThreadSummary = {
  id: string
  historyId: string | null
  subject: string
  snippet: string
  from: Address | null
  to: Address[]
  /** Who the newest unsent draft in the thread is addressed to */
  draftTo: Address[]
  people: { name: string; email: string; me: boolean }[]
  date: number
  count: number
  unread: boolean
  starred: boolean
  important: boolean
  draft: boolean
  attachments: boolean
  labels: string[]
  lastFromMe: boolean
}

export type Attachment = {
  id: string | null
  partId: string | null
  filename: string
  mimeType: string
  size: number
  inline: boolean
  contentId: string | null
  data?: string
}

export type ParsedMessage = {
  id: string
  threadId: string
  labels: string[]
  snippet: string
  date: number
  from: Address | null
  to: Address[]
  cc: Address[]
  bcc: Address[]
  replyTo: Address[]
  subject: string
  messageId: string | null
  references: string | null
  inReplyTo: string | null
  html: string
  text: string
  attachments: Attachment[]
  unread: boolean
  draft: boolean
  fromMe: boolean
  unsubscribe: string | null
  pendingBodies?: { attachmentId: string; mime: string; charset?: string }[]
}

// ---------- Text ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (whole, code: string) => {
    const lower = code.toLowerCase()
    if (lower.startsWith('#x')) return String.fromCodePoint(parseInt(lower.slice(2), 16))
    if (lower.startsWith('#')) return String.fromCodePoint(parseInt(lower.slice(1), 10))
    return ENTITIES[lower] ?? whole
  })
}

function decodeBytes(bytes: Uint8Array, charset?: string): string {
  const label = (charset || 'utf-8').toLowerCase().replace(/^"|"$/g, '')
  try {
    return new TextDecoder(label).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

// RFC 2047 encoded words, in case a header arrives still encoded
export function decodeWords(value: string): string {
  if (!value.includes('=?')) return value
  return value
    .replace(/(\?=)\s+(=\?)/g, '$1$2')
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, charset: string, enc: string, data: string) => {
      try {
        if (enc.toUpperCase() === 'B') {
          const bin = atob(data)
          return decodeBytes(Uint8Array.from(bin, (c) => c.charCodeAt(0)), charset)
        }
        const bytes: number[] = []
        const text = data.replace(/_/g, ' ')
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '=' && /^[0-9a-f]{2}$/i.test(text.slice(i + 1, i + 3))) {
            bytes.push(parseInt(text.slice(i + 1, i + 3), 16))
            i += 2
          } else bytes.push(text.charCodeAt(i))
        }
        return decodeBytes(new Uint8Array(bytes), charset)
      } catch {
        return data
      }
    })
}

// ---------- Addresses ----------

// Splits "Dana Teague <dana@x.com>, \"Lutz, Reggie\" <r@y.com>, plain@z.com"
export function parseAddresses(value: string | null | undefined): Address[] {
  if (!value) return []
  const text = decodeWords(value)
  const parts: string[] = []
  let current = ''
  let quoted = false
  let angle = 0
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '\\' && quoted) {
      current += ch + (text[i + 1] ?? '')
      i++
      continue
    }
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch === '<') angle++
    else if (!quoted && ch === '>') angle = Math.max(0, angle - 1)
    if ((ch === ',' || ch === ';') && !quoted && angle === 0) {
      parts.push(current)
      current = ''
    } else current += ch
  }
  parts.push(current)
  const out: Address[] = []
  for (const raw of parts) {
    const part = raw.trim()
    if (!part) continue
    const angled = part.match(/^(.*)<([^<>]+)>\s*$/)
    if (angled) {
      const name = angled[1].trim().replace(/^"(.*)"$/, '$1').replace(/\\(.)/g, '$1').trim()
      out.push({ name, email: angled[2].trim() })
    } else {
      const comment = part.match(/^([^\s()]+@[^\s()]+)\s*\((.*)\)$/)
      if (comment) out.push({ name: comment[2].trim(), email: comment[1] })
      else if (part.includes('@')) out.push({ name: '', email: part.replace(/^"|"$/g, '') })
    }
  }
  return out
}

// ---------- Headers ----------

export function header(part: GmailPart | undefined, name: string): string | null {
  const lower = name.toLowerCase()
  const found = part?.headers?.find((h) => h.name.toLowerCase() === lower)
  return found ? found.value : null
}

function param(value: string | null, key: string): string | undefined {
  if (!value) return undefined
  const match = value.match(new RegExp(`${key}\\s*=\\s*("([^"]*)"|[^;\\s]+)`, 'i'))
  return match ? (match[2] ?? match[1]) : undefined
}

const has = (m: GmailMessage, label: string) => (m.labelIds ?? []).includes(label)
const isSelf = (address: Address | null | undefined, self: string[]) =>
  !!address && self.includes(address.email.toLowerCase())

// ---------- Summaries ----------

export function summarize(thread: GmailThread, selfEmails: string[]): ThreadSummary {
  const self = selfEmails.map((e) => e.toLowerCase())
  const all = thread.messages ?? []
  const visible = all.filter((m) => !has(m, 'TRASH'))
  const pool = visible.length ? visible : all
  const sent = pool.filter((m) => !has(m, 'DRAFT'))
  const shown = sent.length ? sent : pool
  const first = shown[0]
  const last = shown[shown.length - 1]
  const labels = new Set<string>()
  for (const m of all) for (const l of m.labelIds ?? []) labels.add(l)

  // Senders in the order they joined the conversation, the way Gmail lists them ("Carla, me")
  const people: ThreadSummary['people'] = []
  for (const m of shown) {
    const from = parseAddresses(header(m.payload, 'From'))[0]
    if (!from) continue
    const key = from.email.toLowerCase()
    if (people.some((p) => p.email.toLowerCase() === key)) continue
    people.push({ name: from.name, email: from.email, me: self.includes(key) })
  }

  const subject = decodeWords(header(first?.payload, 'Subject') ?? header(last?.payload, 'Subject') ?? '').trim()
  const from = parseAddresses(header(last?.payload, 'From'))[0] ?? null
  const latestDraft = pool.filter((m) => has(m, 'DRAFT')).pop()
  return {
    id: thread.id,
    historyId: thread.historyId ?? null,
    subject,
    snippet: decodeEntities(last?.snippet ?? '').trim(),
    from,
    to: parseAddresses(header(last?.payload, 'To')),
    draftTo: latestDraft ? parseAddresses(header(latestDraft.payload, 'To')) : [],
    people: people.length > 4 ? [people[0], ...people.slice(-3)] : people,
    date: Number(last?.internalDate ?? 0),
    count: sent.length,
    unread: pool.some((m) => has(m, 'UNREAD')),
    starred: all.some((m) => has(m, 'STARRED')),
    important: all.some((m) => has(m, 'IMPORTANT')),
    draft: all.some((m) => has(m, 'DRAFT')),
    attachments: pool.some((m) => (m.payload?.mimeType ?? '').toLowerCase() === 'multipart/mixed'),
    labels: [...labels],
    lastFromMe: isSelf(from, self),
  }
}

// ---------- Full messages ----------

type Walk = {
  html: string[]
  text: string[]
  attachments: Attachment[]
  pending: { attachmentId: string; mime: string; charset?: string }[]
}

function walk(part: GmailPart | undefined, out: Walk) {
  if (!part) return
  const mime = (part.mimeType ?? '').toLowerCase()
  const disposition = header(part, 'Content-Disposition') ?? ''
  const contentId = (header(part, 'Content-ID') ?? header(part, 'X-Attachment-Id') ?? '').replace(/[<>]/g, '').trim() || null
  if (mime.startsWith('multipart/')) {
    for (const child of part.parts ?? []) walk(child, out)
    return
  }
  const filename = decodeWords(part.filename ?? '')
  const attachedFile = /^attachment/i.test(disposition)
  const textBody = (mime === 'text/plain' || mime === 'text/html' || mime === '') && !filename && !attachedFile
  const charset = param(header(part, 'Content-Type'), 'charset')
  if (textBody) {
    if (part.body?.data) {
      const value = decodeBytes(b64urlDecode(part.body.data), charset)
      if (mime === 'text/html') out.html.push(value)
      else out.text.push(value)
    } else if (part.body?.attachmentId) {
      // Very large bodies arrive as an attachment id instead of inline data
      out.pending.push({ attachmentId: part.body.attachmentId, mime: mime || 'text/plain', charset })
    }
    return
  }
  out.attachments.push({
    id: part.body?.attachmentId ?? null,
    partId: part.partId ?? null,
    filename: filename || (mime === 'message/rfc822' ? 'Forwarded message.eml' : mime.startsWith('image/') ? 'Image' : 'Attachment'),
    mimeType: mime || 'application/octet-stream',
    size: part.body?.size ?? 0,
    inline: !!contentId && !attachedFile,
    contentId,
    ...(part.body?.data && !part.body?.attachmentId ? { data: part.body.data } : {}),
  })
}

export function parseMessage(m: GmailMessage, selfEmails: string[]): ParsedMessage {
  const self = selfEmails.map((e) => e.toLowerCase())
  const p = m.payload
  const out: Walk = { html: [], text: [], attachments: [], pending: [] }
  walk(p, out)
  const from = parseAddresses(header(p, 'From'))[0] ?? null
  return {
    id: m.id,
    threadId: m.threadId,
    labels: m.labelIds ?? [],
    snippet: decodeEntities(m.snippet ?? ''),
    date: Number(m.internalDate ?? 0),
    from,
    to: parseAddresses(header(p, 'To')),
    cc: parseAddresses(header(p, 'Cc')),
    bcc: parseAddresses(header(p, 'Bcc')),
    replyTo: parseAddresses(header(p, 'Reply-To')),
    subject: decodeWords(header(p, 'Subject') ?? '').trim(),
    messageId: header(p, 'Message-ID') ?? header(p, 'Message-Id'),
    references: header(p, 'References'),
    inReplyTo: header(p, 'In-Reply-To'),
    html: out.html.join('\n'),
    text: out.text.join('\n\n'),
    attachments: out.attachments,
    unread: has(m, 'UNREAD'),
    draft: has(m, 'DRAFT'),
    fromMe: isSelf(from, self),
    unsubscribe: header(p, 'List-Unsubscribe'),
    pendingBodies: out.pending,
  }
}

// Fetches bodies that were too large to arrive inline
export async function resolveBodies(message: ParsedMessage, fetchData: (attachmentId: string) => Promise<string>): Promise<ParsedMessage> {
  if (!message.pendingBodies?.length) {
    const { pendingBodies: _p, ...rest } = message
    return rest as ParsedMessage
  }
  let html = message.html
  let text = message.text
  for (const body of message.pendingBodies) {
    try {
      const value = decodeBytes(b64urlDecode(await fetchData(body.attachmentId)), body.charset)
      if (body.mime === 'text/html') html = html ? `${html}\n${value}` : value
      else text = text ? `${text}\n\n${value}` : value
    } catch {
      // skip a body that can't be fetched
    }
  }
  const { pendingBodies: _p, ...rest } = message
  return { ...rest, html, text } as ParsedMessage
}

// Replaces cid: references in the HTML with data URIs, using the fetch function for parts
// whose bytes live behind an attachmentId. Stops inlining after `budget` bytes.
export async function inlineImages(
  message: ParsedMessage,
  fetchData: (attachmentId: string) => Promise<string>,
  budget = 4_000_000,
): Promise<ParsedMessage> {
  if (!message.html || !/cid:/i.test(message.html)) return message
  let used = 0
  let html = message.html
  const attachments = [...message.attachments]
  for (const att of attachments) {
    if (!att.contentId || !att.mimeType.startsWith('image/')) continue
    const needle = new RegExp(`cid:${att.contentId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
    if (!needle.test(html)) continue
    if (used + att.size > budget) continue
    try {
      const data = att.data ?? (att.id ? await fetchData(att.id) : null)
      if (!data) continue
      html = html.replace(needle, `data:${att.mimeType};base64,${b64urlToB64(data)}`)
      used += att.size
      att.inline = true
      delete att.data
    } catch {
      // leave the image out; the attachment still shows in the list
    }
  }
  return { ...message, html, attachments: attachments.map(({ data: _data, ...rest }) => rest) }
}
