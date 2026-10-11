// Merge tags, rich text cleanup and safe values for email HTML.

export const MERGE_TAGS = [
  { key: 'first', label: 'First name', token: '{First name}' },
  { key: 'business', label: 'Business', token: '{Business}' },
]
export const TAG_RE = /\{(First name|Business)\}/g
export const hasTag = (text) => /\{(First name|Business)\}/.test(String(text || ''))

export const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch])

export function safeUrl(url) {
  const value = String(url || '').trim()
  if (!value) return '#'
  if (/^(https?:|mailto:|tel:)/i.test(value)) return value
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`
  return '#'
}

// Pass RESEND_CONTACT as the contact when rendering HTML for a Resend Broadcast.
// Tags then become Resend contact placeholders with your fallbacks, for example {{{contact.first_name|there}}}.
export const RESEND_CONTACT = Object.freeze({ __resend: true })

export function firstNameFor(contact, style) {
  const fallback = (style?.fallback || '').trim() || 'there'
  if (contact?.__resend) return `{{{contact.first_name|${fallback}}}}`
  return (contact?.first || '').trim() || fallback
}
export function businessFor(contact, style) {
  const fallback = (style?.bizFallback || '').trim() || 'your business'
  if (contact?.__resend) return `{{{contact.business|${fallback}}}}`
  return (contact?.business || '').trim() || fallback
}

// Replace tags in plain text, then escape for HTML
export function fillPlain(text, contact, style) {
  return String(text || '').replace(TAG_RE, (_, key) => (key === 'First name' ? firstNameFor(contact, style) : businessFor(contact, style)))
}
export const fillHtmlText = (text, contact, style) => escapeHtml(fillPlain(text, contact, style))

// ---------- Rich text ----------

const BLOCK_TAGS = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'SECTION', 'ARTICLE'])

function parse(html) {
  if (typeof DOMParser === 'undefined') return null
  return new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html').body
}

function inlineOf(node) {
  let out = ''
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      out += escapeHtml(child.nodeValue.replace(/ /g, ' '))
      return
    }
    if (child.nodeType !== 1) return
    const tag = child.tagName
    if (child.classList?.contains('mk-merge') || child.dataset?.merge) {
      const key = child.dataset?.merge
      out += key === 'business' ? '{Business}' : '{First name}'
      return
    }
    const inner = inlineOf(child)
    if (tag === 'BR') out += '<br>'
    else if (tag === 'STRONG' || tag === 'B') out += inner ? `<strong>${inner}</strong>` : ''
    else if (tag === 'EM' || tag === 'I') out += inner ? `<em>${inner}</em>` : ''
    else if (tag === 'U') out += inner ? `<u>${inner}</u>` : ''
    else if (tag === 'A') {
      const href = safeUrl(child.getAttribute('href'))
      out += inner ? `<a href="${escapeHtml(href)}">${inner}</a>` : ''
    } else out += inner
  })
  return out
}

const trimInline = (html) => html.replace(/^(\s|<br>)+|(\s|<br>)+$/g, '').replace(/\s{2,}/g, ' ')

function listOf(node) {
  const tag = node.tagName.toLowerCase()
  const items = [...node.children]
    .filter((li) => li.tagName === 'LI')
    .map((li) => trimInline(inlineOf(li)))
    .filter(Boolean)
  return items.length ? `<${tag}>${items.map((i) => `<li>${i}</li>`).join('')}</${tag}>` : ''
}

// Normalize whatever the editor produced into p / ul / ol with simple inline formatting.
export function cleanRich(html) {
  const body = parse(html)
  if (!body) return String(html || '')
  const out = []
  let pending = ''
  const flush = () => {
    const text = trimInline(pending)
    if (text) out.push(`<p>${text}</p>`)
    pending = ''
  }
  body.childNodes.forEach((node) => {
    if (node.nodeType === 1 && (node.tagName === 'UL' || node.tagName === 'OL')) {
      flush()
      const list = listOf(node)
      if (list) out.push(list)
    } else if (node.nodeType === 1 && BLOCK_TAGS.has(node.tagName)) {
      flush()
      const nested = node.querySelectorAll(':scope > ul, :scope > ol')
      if (nested.length) {
        node.childNodes.forEach((child) => {
          if (child.nodeType === 1 && (child.tagName === 'UL' || child.tagName === 'OL')) {
            flush()
            const list = listOf(child)
            if (list) out.push(list)
          } else {
            const wrap = document.createElement('span')
            wrap.appendChild(child.cloneNode(true))
            pending += inlineOf(wrap)
          }
        })
        flush()
      } else {
        const text = trimInline(inlineOf(node))
        if (text) out.push(`<p>${text}</p>`)
      }
    } else {
      const wrap = document.createElement('span')
      wrap.appendChild(node.cloneNode(true))
      pending += inlineOf(wrap)
    }
  })
  flush()
  return out.join('')
}

export function plainText(html) {
  if (!html) return ''
  const body = parse(String(html).replace(/<\/(p|li)>/g, '</$1> ').replace(/<br>/g, ' '))
  if (!body) return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return body.textContent.replace(/\s+/g, ' ').trim()
}

// Stored tokens to editor chips, and back
export function tokensToChips(html) {
  return String(html || '').replace(TAG_RE, (_, key) => {
    const k = key === 'Business' ? 'business' : 'first'
    return `<span class="mk-merge" data-merge="${k}" contenteditable="false">${key}</span>`
  })
}

export function linksIn(html) {
  const body = parse(html)
  if (!body) return []
  return [...body.querySelectorAll('a')].map((a) => ({ label: a.textContent.trim(), url: a.getAttribute('href') }))
}

// Inline-style rich text for email output
export function richToEmail(html, { contact, style, color, strongColor, linkColor, size, lineHeight, align }) {
  const body = parse(html)
  if (!body) return ''
  const tagText = (text) => escapeHtml(fillPlain(text, contact, style))
  const walk = (node) => {
    let out = ''
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        out += tagText(child.nodeValue)
        return
      }
      if (child.nodeType !== 1) return
      const tag = child.tagName
      const inner = walk(child)
      if (tag === 'BR') out += '<br>'
      else if (tag === 'STRONG' || tag === 'B') out += `<strong style="font-weight:700;color:${strongColor};">${inner}</strong>`
      else if (tag === 'EM' || tag === 'I') out += `<em style="font-style:italic;">${inner}</em>`
      else if (tag === 'U') out += `<u style="text-decoration:underline;">${inner}</u>`
      else if (tag === 'A') out += `<a href="${escapeHtml(safeUrl(child.getAttribute('href')))}" target="_blank" style="color:${linkColor};text-decoration:underline;font-weight:600;">${inner}</a>`
      else if (tag === 'LI') out += `<li style="margin:0 0 8px;padding-left:2px;">${inner}</li>`
      else out += inner
    })
    return out
  }
  return [...body.children]
    .map((el, i) => {
      const tag = el.tagName.toLowerCase()
      const top = i === 0 ? 0 : 14
      if (tag === 'ul' || tag === 'ol') {
        return `<${tag} style="margin:${top}px 0 0;padding:0 0 0 22px;color:${color};font-size:${size}px;line-height:${lineHeight}px;text-align:left;">${walk(el)}</${tag}>`
      }
      return `<p style="margin:${top}px 0 0;color:${color};font-size:${size}px;line-height:${lineHeight}px;text-align:${align};">${walk(el)}</p>`
    })
    .join('')
}
