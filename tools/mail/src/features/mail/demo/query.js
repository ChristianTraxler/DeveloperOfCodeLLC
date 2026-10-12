// A small Gmail search matcher for the example inbox. The live version sends the same
// text straight to Gmail, which understands every operator.
//
// Supported here: plain words, "exact phrases", from:, to:, subject:, label:, in:, is:unread,
// is:read, is:starred, has:attachment, and a leading - to exclude.

function tokens(q) {
  const out = []
  const re = /(-?)(\w+:)?("([^"]*)"|\S+)/g
  let m
  while ((m = re.exec(q))) {
    const negate = m[1] === '-'
    const op = m[2] ? m[2].slice(0, -1).toLowerCase() : null
    const value = (m[4] ?? m[3] ?? '').toLowerCase()
    if (!value) continue
    out.push({ negate, op, value })
  }
  return out
}

const text = (a) => `${a?.name || ''} ${a?.email || ''}`.toLowerCase()

// thread: { messages: [{ from, to, cc, subject, text, html, labels, attachments }] }, labelName(id) -> name
export function matches(thread, q, labelName = (id) => id) {
  const list = tokens(q || '')
  if (!list.length) return true
  const msgs = thread.messages
  const labels = new Set(msgs.flatMap((m) => m.labels))
  const body = msgs.map((m) => `${m.subject} ${m.text || ''} ${(m.html || '').replace(/<[^>]+>/g, ' ')}`).join(' ').toLowerCase()
  const fromAll = msgs.map((m) => text(m.from)).join(' ')
  const toAll = msgs.map((m) => [...(m.to || []), ...(m.cc || [])].map(text).join(' ')).join(' ')
  const subjects = msgs.map((m) => (m.subject || '').toLowerCase()).join(' ')
  const labelNames = [...labels].map((id) => String(labelName(id) || id).toLowerCase())

  return list.every(({ negate, op, value }) => {
    let hit
    switch (op) {
      case 'from':
        hit = fromAll.includes(value)
        break
      case 'to':
        hit = toAll.includes(value)
        break
      case 'subject':
        hit = subjects.includes(value)
        break
      case 'label':
        hit = labelNames.some((n) => n === value || n.replace(/\s+/g, '-') === value)
        break
      case 'in':
        hit = value === 'anywhere' || labels.has(value.toUpperCase()) || (value === 'sent' && labels.has('SENT')) || (value === 'drafts' && labels.has('DRAFT'))
        break
      case 'is':
        if (value === 'unread') hit = labels.has('UNREAD')
        else if (value === 'read') hit = !labels.has('UNREAD')
        else if (value === 'starred') hit = labels.has('STARRED')
        else if (value === 'important') hit = labels.has('IMPORTANT')
        else hit = false
        break
      case 'has':
        hit = value === 'attachment' ? msgs.some((m) => (m.attachments || []).some((a) => !a.inline)) : false
        break
      default:
        hit = body.includes(value) || fromAll.includes(value) || toAll.includes(value)
    }
    return negate ? !hit : hit
  })
}

// Gmail leaves spam and trash out of searches unless you ask for them
export const wantsSpamOrTrash = (q) => /\bin:(spam|trash|anywhere)\b/i.test(q || '')
