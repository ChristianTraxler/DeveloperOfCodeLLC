// Seals Google tokens with AES-GCM before they reach the database.
// The key (MAIL_TOKEN_KEY, 32 random bytes in base64) lives only in Edge Function secrets,
// so a database export alone can't be used to read the mailbox.
import { b64decode, b64encode, utf8 } from './base64.ts'
import { ConfigError, env } from './env.ts'

let cached: Promise<CryptoKey> | null = null

function key(): Promise<CryptoKey> {
  if (!cached) {
    const raw = b64decode(env('MAIL_TOKEN_KEY'))
    if (raw.length !== 32) throw new ConfigError('MAIL_TOKEN_KEY (it must be 32 random bytes in base64)')
    cached = crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  return cached
}

export async function seal(text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(), utf8(text)))
  const out = new Uint8Array(iv.length + sealed.length)
  out.set(iv)
  out.set(sealed, iv.length)
  return `v1.${b64encode(out)}`
}

export async function unseal(value: string): Promise<string> {
  if (!value.startsWith('v1.')) throw new Error('Unknown token format')
  const bytes = b64decode(value.slice(3))
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.subarray(0, 12) }, await key(), bytes.subarray(12))
  return new TextDecoder().decode(plain)
}
