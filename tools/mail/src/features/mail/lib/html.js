// Makes an email safe to show. The HTML is parsed in an inert document (nothing loads, no
// scripts run), cleaned with DOMPurify, and wrapped in a page with its own Content Security
// Policy. The Mail page then shows it inside a sandboxed iframe that can't run scripts.
//
// Remote images stay off until you allow them, and tracking pixels are removed either way.
import DOMPurify from 'dompurify'

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
const REMOTE = /^\s*(https?:)?\/\//i
const TRACKER =
  /(\/o\.gif|\/open(\.gif|\.png|\.php|\?|\/)|[?&/_.-]pixel|beacon|\/track(ing)?\/|\/trk\/|\/wf\/open|mailtrack|list-manage\.com\/track|\/e2t\/|emltrk|ea\.pstmrk|mandrillapp\.com\/track|\/ss\/o\/|\/t\/o\/|open\.aspx)/i
const QUOTES = [
  'div.gmail_quote',
  'blockquote.gmail_quote',
  'blockquote[type="cite"]',
  'div.yahoo_quoted',
  'div.moz-cite-prefix',
  'div#divRplyFwdMsg',
  'div[id^="appendonsend"]',
  'div.doc-plain-quote',
]

const BASE_CSS = `
html,body{margin:0;padding:0;background:#ffffff}
body{font:15px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2433;-webkit-text-size-adjust:100%;overflow-wrap:break-word}
.doc-root{padding:2px 0 8px}
.doc-plain{white-space:pre-wrap;font:15.5px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#1d2433}
.doc-plain-quote{margin:14px 0 0;border-left:2px solid #dcd8cf;padding-left:12px;color:#5d6577}
img{max-width:100%;height:auto}
a{color:#c4410c}
pre{white-space:pre-wrap}
blockquote.gmail_quote{margin:0 0 0 .8ex;border-left:2px solid #dcd8cf;padding-left:1.2ex}
.doc-quote-hidden{display:none!important}
.doc-blocked{background:repeating-linear-gradient(135deg,#f3f1ec 0 6px,#ebe8e1 6px 12px)}
`

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

function linkify(escaped) {
  return escaped
    .replace(/\b((?:https?:\/\/|www\.)[^\s<]+[^\s<.,;:!?)\]'"])/gi, (url) => {
      const href = url.startsWith('www.') ? `https://${url}` : url
      return `<a href="${href}">${url}</a>`
    })
    .replace(/(^|[\s(])([\w.+-]+@[\w-]+\.[\w.-]*\w)/g, (m, lead, email) => `${lead}<a href="mailto:${email}">${email}</a>`)
}

// Plain-text email to HTML, with the quoted reply (if any) set apart so it can be folded away
export function textToHtml(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n')
  let quoteAt = -1
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    const joined = `${line} ${(lines[i + 1] || '').trim()}`
    if (/^On .{6,220}wrote:$/.test(line) || /^On .{6,220}wrote:$/.test(joined) || /^-{2,}\s*Original Message\s*-{2,}$/i.test(line)) {
      quoteAt = i
      break
    }
    if (/^>/.test(lines[i]) && lines.slice(i).every((l) => /^>/.test(l) || !l.trim())) {
      quoteAt = i
      break
    }
  }
  const main = lines.slice(0, quoteAt === -1 ? lines.length : quoteAt).join('\n').replace(/\s+$/, '')
  const quote = quoteAt === -1 ? '' : lines.slice(quoteAt).join('\n')
  return `<div class="doc-plain">${linkify(escapeHtml(main))}</div>${quote ? `<div class="doc-plain doc-plain-quote">${linkify(escapeHtml(quote))}</div>` : ''}`
}

function cleanCss(css, loadImages, rewrite) {
  let out = String(css || '')
    .replace(/@import[^;]+;?/gi, '')
    .replace(/expression\s*\(/gi, '(')
    .replace(/behavior\s*:/gi, 'x-behavior:')
    .replace(/-moz-binding\s*:/gi, 'x-binding:')
    .replace(/<\/style/gi, '<\\/style')
  out = out.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (whole, _q, url) => {
    if (!REMOTE.test(url)) return whole
    if (!loadImages) return 'none'
    const swapped = rewrite?.(url.trim())
    return swapped ? `url("${swapped}")` : whole
  })
  return out
}

function wrapTrailing(el, doc) {
  // Outlook puts the quoted message after a marker element, as following siblings
  const box = doc.createElement('div')
  const prev = el.previousElementSibling
  const startAt = prev && prev.tagName === 'HR' ? prev : el
  startAt.parentNode.insertBefore(box, startAt)
  let node = startAt
  while (node) {
    const next = node.nextSibling
    box.appendChild(node)
    node = next
  }
  return box
}

export function prepareEmail(message, { loadImages = false, showQuote = false, rewrite = null } = {}) {
  const source = message?.html?.trim() ? message.html : textToHtml(message?.text || message?.snippet || '')
  const parsed = new DOMParser().parseFromString(source, 'text/html')
  const styles = [...parsed.querySelectorAll('style')].map((s) => s.textContent || '')
  const body = parsed.body
  const wrapperStyle = body?.getAttribute('style') || ''
  const wrapperBg = body?.getAttribute('bgcolor') || ''
  const inner = body ? body.innerHTML : source
  const wrapped = `<div class="doc-body"${wrapperStyle ? ` style="${escapeHtml(wrapperStyle)}"` : ''}${wrapperBg ? ` bgcolor="${escapeHtml(wrapperBg)}"` : ''}>${inner}</div>`

  // DOMPurify returns a string; it is parsed again in an inert document so nothing in it can
  // start loading (an <img> adopted into the live page would fetch its src right away).
  const cleanHtml = DOMPurify.sanitize(wrapped, {
    FORBID_TAGS: ['style', 'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'form', 'input', 'button', 'textarea', 'select', 'option', 'link', 'meta', 'base', 'noscript', 'template', 'audio', 'video', 'source', 'track'],
    FORBID_ATTR: ['srcset', 'action', 'formaction', 'ping', 'autofocus'],
    ADD_ATTR: ['target', 'bgcolor', 'background', 'align', 'valign', 'cellpadding', 'cellspacing'],
  })
  const work = new DOMParser().parseFromString(`<body>${cleanHtml}</body>`, 'text/html')
  const doc = work
  const frag = work.body

  let blocked = 0
  let trackers = 0
  let remote = 0

  for (const img of [...frag.querySelectorAll('img')]) {
    const src = img.getAttribute('src') || ''
    if (!REMOTE.test(src)) continue
    const w = parseInt(img.getAttribute('width') || '0', 10)
    const h = parseInt(img.getAttribute('height') || '0', 10)
    const hidden = /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(\D|$)/i.test(img.getAttribute('style') || '')
    if ((w > 0 && w <= 3) || (h > 0 && h <= 3) || hidden || TRACKER.test(src)) {
      trackers++
      img.remove()
      continue
    }
    remote++
    if (loadImages) {
      const swapped = rewrite?.(src.trim())
      if (swapped) img.setAttribute('src', swapped)
    } else {
      blocked++
      img.setAttribute('data-blocked-src', src)
      img.setAttribute('src', PIXEL)
      img.classList.add('doc-blocked')
    }
  }

  for (const el of [...frag.querySelectorAll('[background]')]) {
    const url = el.getAttribute('background') || ''
    if (!REMOTE.test(url)) continue
    remote++
    if (!loadImages) {
      el.removeAttribute('background')
      blocked++
    } else {
      const swapped = rewrite?.(url.trim())
      if (swapped) el.setAttribute('background', swapped)
    }
  }

  for (const el of [...frag.querySelectorAll('[style]')]) {
    const style = el.getAttribute('style') || ''
    if (!/url\(/i.test(style)) continue
    const cleaned = cleanCss(style, loadImages, rewrite)
    if (cleaned !== style) {
      if (!loadImages) blocked++
      el.setAttribute('style', cleaned)
    }
  }

  for (const a of [...frag.querySelectorAll('a[href]')]) {
    a.setAttribute('target', '_blank')
    a.setAttribute('rel', 'noopener noreferrer')
  }

  // Fold away the quoted earlier messages, the way Gmail does
  let quotes = 0
  for (const el of [...frag.querySelectorAll(QUOTES.join(','))]) {
    if (!frag.contains(el)) continue
    if (el.parentElement?.closest('.doc-quote')) continue
    const box = el.id === 'divRplyFwdMsg' || (el.id || '').startsWith('appendonsend') ? wrapTrailing(el, doc) : el
    box.classList.add('doc-quote')
    quotes++
  }
  let hasQuote = false
  if (quotes) {
    const probe = frag.cloneNode(true)
    probe.querySelectorAll('.doc-quote').forEach((q) => q.remove())
    hasQuote = (probe.textContent || '').replace(/\s+/g, '').length > 0
    if (hasQuote && !showQuote) frag.querySelectorAll('.doc-quote').forEach((q) => q.classList.add('doc-quote-hidden'))
    if (!hasQuote) frag.querySelectorAll('.doc-quote').forEach((q) => q.classList.remove('doc-quote'))
  }

  const holder = frag
  const csp = [
    "default-src 'none'",
    `img-src data: blob:${loadImages ? ' https: http:' : ''}`,
    "style-src 'unsafe-inline'",
    `font-src data:${loadImages ? ' https:' : ''}`,
  ].join('; ')
  const html =
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<meta name="color-scheme" content="light only"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<base target="_blank"><style>${BASE_CSS}</style>` +
    styles.map((s) => `<style>${cleanCss(s, loadImages, rewrite)}</style>`).join('') +
    `</head><body><div class="doc-root">${holder.innerHTML}</div></body></html>`

  return { html, blocked, trackers, remote, hasQuote }
}

// Plain text from composer HTML, for the text/plain half of an outgoing message
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html')
  const out = []
  const walk = (node) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        out.push(child.nodeValue.replace(/\s+/g, ' '))
        continue
      }
      if (child.nodeType !== 1) continue
      const tag = child.tagName
      if (tag === 'BR') {
        out.push('\n')
        continue
      }
      if (tag === 'LI') out.push('\n- ')
      if (/^(P|DIV|H\d|UL|OL|BLOCKQUOTE|TABLE|TR)$/.test(tag)) out.push('\n')
      walk(child)
      if (tag === 'A') {
        const href = child.getAttribute('href') || ''
        const label = child.textContent || ''
        if (href && !href.startsWith('mailto:') && href !== label && `https://${label}` !== href) out.push(` (${href})`)
      }
      if (/^(P|DIV|H\d|UL|OL|BLOCKQUOTE|TABLE)$/.test(tag)) out.push('\n')
    }
  }
  walk(doc.body)
  return out
    .join('')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
