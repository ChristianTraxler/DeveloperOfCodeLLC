// Email addresses: parsing what people type or paste, and formatting for display.

export const isEmail = (value) => /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]{2,}$/.test(String(value || '').trim())

export const sameEmail = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase()

// Turns 'Dana Teague <dana@x.com>, bob@y.com; "Lutz, Reggie" <r@z.com>' into address objects
export function parseAddressList(text) {
  const out = []
  let current = ''
  let quoted = false
  let angle = 0
  const push = () => {
    const part = current.trim()
    current = ''
    if (!part) return
    const angled = part.match(/^(.*)<([^<>]+)>\s*$/)
    if (angled) {
      out.push({ name: angled[1].trim().replace(/^"(.*)"$/, '$1').trim(), email: angled[2].trim() })
      return
    }
    // Plain addresses separated by spaces, as people often paste them
    for (const piece of part.split(/\s+/)) if (piece) out.push({ name: '', email: piece.replace(/^"|"$/g, '') })
  }
  for (const ch of String(text || '')) {
    if (ch === '"') quoted = !quoted
    else if (!quoted && ch === '<') angle++
    else if (!quoted && ch === '>') angle = Math.max(0, angle - 1)
    if ((ch === ',' || ch === ';' || ch === '\n') && !quoted && angle === 0) push()
    else current += ch
  }
  push()
  return out
}

export function formatAddress(address) {
  if (!address) return ''
  return address.name ? `${address.name} <${address.email}>` : address.email
}

export function uniqueAddresses(list, exclude = []) {
  const seen = new Set(exclude.map((e) => String(e).toLowerCase()))
  const out = []
  for (const a of list || []) {
    if (!a?.email) continue
    const key = a.email.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name: a.name || '', email: a.email })
  }
  return out
}

export const domainOf = (email) => String(email || '').split('@')[1]?.toLowerCase() || ''
