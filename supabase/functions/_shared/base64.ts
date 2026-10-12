// Base64 helpers that work on raw bytes, so non-ASCII text and binary attachments survive.

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)

export function b64encode(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function b64decode(text: string): Uint8Array {
  const binary = atob(text.replace(/[\s\r\n]/g, ''))
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function b64urlToB64(text: string): string {
  let out = text.replace(/-/g, '+').replace(/_/g, '/').replace(/[\s\r\n]/g, '')
  while (out.length % 4) out += '='
  return out
}

export const b64ToB64url = (text: string): string => text.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const b64urlDecode = (text: string): Uint8Array => b64decode(b64urlToB64(text))
export const b64urlEncode = (bytes: Uint8Array): string => b64ToB64url(b64encode(bytes))

// MIME bodies are base64 wrapped at 76 characters per line
export function wrap76(b64: string): string {
  const lines: string[] = []
  for (let i = 0; i < b64.length; i += 76) lines.push(b64.slice(i, i + 76))
  return lines.join('\r\n')
}

// Approximate decoded size of a base64 string, without decoding it
export function b64Size(b64: string): number {
  const clean = b64.replace(/[\s\r\n=]/g, '')
  return Math.floor((clean.length * 3) / 4)
}

export function randomToken(bytes = 24): string {
  const raw = crypto.getRandomValues(new Uint8Array(bytes))
  return Array.from(raw, (b) => b.toString(16).padStart(2, '0')).join('')
}

// Compares secrets without leaking how much of them matched through timing
export function safeEqual(a: string, b: string): boolean {
  const x = utf8(a)
  const y = utf8(b)
  let diff = x.length ^ y.length
  const len = Math.max(x.length, y.length)
  for (let i = 0; i < len; i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return diff === 0 && x.length > 0
}
