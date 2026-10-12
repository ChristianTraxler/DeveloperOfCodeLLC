// Thin wrapper over the Gmail REST API (users/me/...). Retries briefly on rate limits and
// server errors, and turns Gmail's error JSON into GmailError.
import { b64urlEncode, utf8 } from './base64.ts'
import { pool, sleep } from './http.ts'

const API = 'https://gmail.googleapis.com/gmail/v1/users/me/'
const UPLOAD = 'https://gmail.googleapis.com/upload/gmail/v1/users/me/'

export class GmailError extends Error {
  status: number
  reason?: string
  constructor(status: number, message: string, reason?: string) {
    super(message)
    this.status = status
    this.reason = reason
  }
}

type Init = { method?: string; json?: unknown; body?: string; contentType?: string; base?: string }

export async function gmail<T = any>(token: string, path: string, init: Init = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
  let body = init.body
  if (init.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.json)
  } else if (init.contentType) {
    headers['Content-Type'] = init.contentType
  }
  const method = init.method ?? (body !== undefined ? 'POST' : 'GET')
  for (let attempt = 0; ; attempt++) {
    const res = await fetch((init.base ?? API) + path, { method, headers, body })
    if (res.ok) {
      const text = await res.text()
      return (text ? JSON.parse(text) : undefined) as T
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(400 * (attempt + 1) ** 2)
      continue
    }
    let message = res.statusText || 'Gmail error'
    let reason: string | undefined
    try {
      const data = await res.json()
      message = data?.error?.message ?? message
      reason = data?.error?.errors?.[0]?.reason ?? data?.error?.status
    } catch {
      // keep the status text
    }
    throw new GmailError(res.status, message, reason)
  }
}

// ---------- Reading ----------

const META_HEADERS = ['From', 'To', 'Cc', 'Subject', 'Date']
const META_FIELDS = 'id,historyId,messages(id,threadId,labelIds,snippet,internalDate,payload(mimeType,headers))'

export type GmailHeader = { name: string; value: string }
export type GmailPart = {
  partId?: string
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { attachmentId?: string; size?: number; data?: string }
  parts?: GmailPart[]
}
export type GmailMessage = {
  id: string
  threadId: string
  labelIds?: string[]
  snippet?: string
  internalDate?: string
  historyId?: string
  payload?: GmailPart
}
export type GmailThread = { id: string; historyId?: string; messages?: GmailMessage[] }

export async function listThreads(token: string, opts: { labelId?: string; q?: string; pageToken?: string; max?: number }) {
  const params = new URLSearchParams({ maxResults: String(Math.min(Math.max(opts.max ?? 30, 1), 50)) })
  if (opts.labelId && opts.labelId !== 'ALL') params.append('labelIds', opts.labelId)
  if (opts.q) params.set('q', opts.q)
  if (opts.pageToken) params.set('pageToken', opts.pageToken)
  return gmail<{ threads?: { id: string }[]; nextPageToken?: string; resultSizeEstimate?: number }>(token, `threads?${params}`)
}

export function threadMeta(token: string, id: string): Promise<GmailThread> {
  const params = new URLSearchParams({ format: 'metadata', fields: META_FIELDS })
  for (const h of META_HEADERS) params.append('metadataHeaders', h)
  return gmail<GmailThread>(token, `threads/${encodeURIComponent(id)}?${params}`)
}

// Metadata for many threads. Threads that no longer exist come back as null.
export async function threadMetas(token: string, ids: string[]): Promise<(GmailThread | null)[]> {
  return pool(ids, 10, async (id) => {
    try {
      return await threadMeta(token, id)
    } catch (err) {
      if (err instanceof GmailError && err.status === 404) return null
      throw err
    }
  })
}

export const threadFull = (token: string, id: string) =>
  gmail<GmailThread>(token, `threads/${encodeURIComponent(id)}?format=full`)

export const attachmentData = (token: string, messageId: string, attachmentId: string) =>
  gmail<{ size: number; data: string }>(token, `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`)

export const profile = (token: string) =>
  gmail<{ emailAddress: string; messagesTotal: number; threadsTotal: number; historyId: string }>(token, 'profile')

export type GmailLabel = {
  id: string
  name: string
  type: 'system' | 'user'
  labelListVisibility?: string
  color?: { textColor?: string; backgroundColor?: string }
  messagesTotal?: number
  messagesUnread?: number
  threadsTotal?: number
  threadsUnread?: number
}

export const labelsList = (token: string) => gmail<{ labels?: GmailLabel[] }>(token, 'labels')
export const labelGet = (token: string, id: string) => gmail<GmailLabel>(token, `labels/${encodeURIComponent(id)}`)

export type SendAs = { sendAsEmail: string; displayName?: string; signature?: string; isDefault?: boolean; isPrimary?: boolean; verificationStatus?: string }
export async function sendAsList(token: string): Promise<SendAs[]> {
  const res = await gmail<{ sendAs?: SendAs[] }>(token, 'settings/sendAs')
  return (res.sendAs ?? []).filter((s) => s.isPrimary || !s.verificationStatus || s.verificationStatus === 'accepted')
}

export function history(token: string, startHistoryId: string, pageToken?: string) {
  const params = new URLSearchParams({ startHistoryId, maxResults: '500' })
  if (pageToken) params.set('pageToken', pageToken)
  return gmail<{
    history?: {
      id: string
      messages?: { id: string; threadId: string }[]
      messagesAdded?: { message: { id: string; threadId: string; labelIds?: string[] } }[]
      messagesDeleted?: { message: { id: string; threadId: string } }[]
      labelsAdded?: { message: { id: string; threadId: string }; labelIds?: string[] }[]
      labelsRemoved?: { message: { id: string; threadId: string }; labelIds?: string[] }[]
    }[]
    nextPageToken?: string
    historyId?: string
  }>(token, `history?${params}`)
}

// ---------- Changing ----------

export const modifyThread = (token: string, id: string, add: string[] = [], remove: string[] = []) =>
  gmail(token, `threads/${encodeURIComponent(id)}/modify`, { json: { addLabelIds: add, removeLabelIds: remove } })

export const trashThread = (token: string, id: string) => gmail(token, `threads/${encodeURIComponent(id)}/trash`, { method: 'POST' })
export const untrashThread = (token: string, id: string) => gmail(token, `threads/${encodeURIComponent(id)}/untrash`, { method: 'POST' })

// Small messages go up as JSON; large ones (big attachments) use Gmail's multipart upload,
// which accepts messages up to 35 MB.
const JSON_LIMIT = 4_500_000

function related(meta: unknown, mime: string) {
  const boundary = `doc_mail_${crypto.randomUUID().replace(/-/g, '')}`
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n` +
    `--${boundary}\r\nContent-Type: message/rfc822\r\n\r\n${mime}\r\n--${boundary}--`
  return { body, contentType: `multipart/related; boundary=${boundary}` }
}

export async function sendMime(token: string, mime: string, threadId?: string) {
  if (mime.length < JSON_LIMIT) {
    return gmail<{ id: string; threadId: string; labelIds?: string[] }>(token, 'messages/send', {
      json: { raw: b64urlEncode(utf8(mime)), ...(threadId ? { threadId } : {}) },
    })
  }
  const { body, contentType } = related(threadId ? { threadId } : {}, mime)
  return gmail<{ id: string; threadId: string; labelIds?: string[] }>(token, 'messages/send?uploadType=multipart', { body, contentType, base: UPLOAD })
}

type Draft = { id: string; message: { id: string; threadId: string } }

export async function saveDraftMime(token: string, mime: string, opts: { draftId?: string; threadId?: string }) {
  const message = opts.threadId ? { threadId: opts.threadId } : {}
  const small = mime.length < JSON_LIMIT
  if (opts.draftId) {
    const path = `drafts/${encodeURIComponent(opts.draftId)}`
    if (small) {
      return gmail<Draft>(token, path, { method: 'PUT', json: { id: opts.draftId, message: { ...message, raw: b64urlEncode(utf8(mime)) } } })
    }
    const { body, contentType } = related({ id: opts.draftId, message }, mime)
    return gmail<Draft>(token, `${path}?uploadType=multipart`, { method: 'PUT', body, contentType, base: UPLOAD })
  }
  if (small) return gmail<Draft>(token, 'drafts', { json: { message: { ...message, raw: b64urlEncode(utf8(mime)) } } })
  const { body, contentType } = related({ message }, mime)
  return gmail<Draft>(token, 'drafts?uploadType=multipart', { body, contentType, base: UPLOAD })
}

export const deleteDraft = (token: string, id: string) => gmail(token, `drafts/${encodeURIComponent(id)}`, { method: 'DELETE' })

export async function listDrafts(token: string): Promise<Draft[]> {
  const res = await gmail<{ drafts?: Draft[] }>(token, 'drafts?maxResults=200')
  return res.drafts ?? []
}

// ---------- Push ----------

export const watchMailbox = (token: string, topicName: string) =>
  gmail<{ historyId: string; expiration: string }>(token, 'watch', { json: { topicName } })

export const stopWatch = (token: string) => gmail(token, 'stop', { method: 'POST' })
