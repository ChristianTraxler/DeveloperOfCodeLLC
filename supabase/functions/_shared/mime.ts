// Builds RFC 5322 / MIME messages for sending and drafts. Everything non-ASCII is encoded
// (base64 bodies, RFC 2047 headers, RFC 2231 filenames), so the result is plain ASCII.
import { b64encode, utf8, wrap76 } from './base64.ts'
import type { Address } from './parse.ts'

const CRLF = '\r\n'

export type OutgoingAttachment = {
  filename: string
  mimeType: string
  data: string // standard base64
  contentId?: string
}

export type Outgoing = {
  from: Address
  to: Address[]
  cc?: Address[]
  bcc?: Address[]
  replyTo?: Address[]
  subject: string
  html: string
  text: string
  inReplyTo?: string | null
  references?: string | null
  attachments?: OutgoingAttachment[]
}

// Header values never carry line breaks, which would let text inject extra headers
const clean = (value: string) => value.replace(/[\r\n]+/g, ' ').trim()
const isAscii = (value: string) => /^[\x20-\x7e]*$/.test(value)

export function encodeWord(value: string): string {
  const text = clean(value)
  if (isAscii(text)) return text
  const bytes = utf8(text)
  const words: string[] = []
  let start = 0
  while (start < bytes.length) {
    let end = Math.min(start + 42, bytes.length)
    // Never split a multi-byte character across two encoded words
    while (end < bytes.length && end > start && (bytes[end] & 0xc0) === 0x80) end--
    words.push(`=?UTF-8?B?${b64encode(bytes.subarray(start, end))}?=`)
    start = end
  }
  return words.join(`${CRLF} `)
}

export const isEmail = (value: string) => /^[^\s@<>(),;:"\[\]\\]+@[^\s@<>(),;:"\[\]\\]+\.[^\s@<>(),;:"\[\]\\]+$/.test(value.trim())

export function formatAddress(address: Address): string {
  const email = clean(address.email)
  const name = clean(address.name ?? '')
  if (!name || name.toLowerCase() === email.toLowerCase()) return email
  if (!isAscii(name)) return `${encodeWord(name)} <${email}>`
  if (/[()<>\[\]:;@\\,."]/.test(name)) return `"${name.replace(/(["\\])/g, '\\$1')}" <${email}>`
  return `${name} <${email}>`
}

const formatList = (list: Address[] = []) => list.filter((a) => a.email).map(formatAddress).join(`,${CRLF} `)

function filenameParams(filename: string): { name: string; disposition: string } {
  const safe = clean(filename).replace(/["\\]/g, '_') || 'attachment'
  if (isAscii(safe)) return { name: `name="${safe}"`, disposition: `filename="${safe}"` }
  const fallback = safe.replace(/[^\x20-\x7e]/g, '_')
  const encoded = encodeURIComponent(safe).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
  return {
    name: `name="${fallback}"`,
    disposition: `filename="${fallback}"; filename*=UTF-8''${encoded}`,
  }
}

const boundary = (tag: string) => `=_doc_${tag}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`

function textPart(type: 'plain' | 'html', body: string): string {
  return [
    `Content-Type: text/${type}; charset="UTF-8"`,
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64encode(utf8(body))),
  ].join(CRLF)
}

function attachmentPart(att: OutgoingAttachment): string {
  const { name, disposition } = filenameParams(att.filename)
  const type = /^[\w.+-]+\/[\w.+-]+$/.test(att.mimeType) ? att.mimeType : 'application/octet-stream'
  const lines = [
    `Content-Type: ${type}; ${name}`,
    `Content-Disposition: ${att.contentId ? 'inline' : 'attachment'}; ${disposition}`,
    'Content-Transfer-Encoding: base64',
  ]
  if (att.contentId) lines.push(`Content-ID: <${clean(att.contentId)}>`)
  return [...lines, '', wrap76(att.data.replace(/[\s\r\n]/g, ''))].join(CRLF)
}

function multipart(kind: string, parts: string[]): string {
  const b = boundary(kind)
  return [
    `Content-Type: multipart/${kind}; boundary="${b}"`,
    '',
    ...parts.map((part) => `--${b}${CRLF}${part}`),
    `--${b}--`,
  ].join(CRLF)
}

export function buildMime(msg: Outgoing): string {
  const headers = [`From: ${formatAddress(msg.from)}`]
  if (msg.to.length) headers.push(`To: ${formatList(msg.to)}`)
  if (msg.cc?.length) headers.push(`Cc: ${formatList(msg.cc)}`)
  if (msg.bcc?.length) headers.push(`Bcc: ${formatList(msg.bcc)}`)
  if (msg.replyTo?.length) headers.push(`Reply-To: ${formatList(msg.replyTo)}`)
  headers.push(`Subject: ${encodeWord(msg.subject || '')}`)
  headers.push(`Date: ${new Date().toUTCString().replace('GMT', '+0000')}`)
  if (msg.inReplyTo) headers.push(`In-Reply-To: ${clean(msg.inReplyTo)}`)
  if (msg.references) headers.push(`References: ${clean(msg.references)}`)
  headers.push('MIME-Version: 1.0')

  const alternative = multipart('alternative', [textPart('plain', msg.text || ' '), textPart('html', msg.html || '<p></p>')])
  const files = msg.attachments ?? []
  const body = files.length ? multipart('mixed', [alternative, ...files.map(attachmentPart)]) : alternative
  return `${headers.join(CRLF)}${CRLF}${body}${CRLF}`
}
