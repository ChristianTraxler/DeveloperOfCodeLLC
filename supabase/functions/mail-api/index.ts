// mail-api: everything the Mail page does with Gmail, behind the admin login.
//
// POST JSON { action, ...fields }. Actions:
//   status                         linked account, live-update state, send-as addresses, history id
//   labels                         folders and labels with unread counts
//   list      { labelId?, q?, pageToken?, max? }   one page of threads
//   threads   { ids }              fresh summaries for specific threads (used after a change)
//   thread    { id }               the full conversation, with HTML, text and attachments
//   attachment { messageId, attachmentId }   one attachment's bytes (base64)
//   modify    { ids, add?, remove? }         add or remove labels (read, star, archive, spam...)
//   trash / untrash { ids }
//   send      { ...message, threadId?, draftId? }
//   saveDraft { ...message, draftId?, threadId? }
//   deleteDraft { draftId }
//   sync      { historyId }        what changed since a history id (the page's fallback)
//   watch                          renews the Gmail watch now
import { optionalEnv } from '../_shared/env.ts'
import { HttpError, corsHeaders, errorResponse, json, pool } from '../_shared/http.ts'
import { b64Size, b64urlToB64 } from '../_shared/base64.ts'
import { ReauthError, accessTokenFor } from '../_shared/google.ts'
import {
  GmailError,
  attachmentData,
  deleteDraft,
  labelGet,
  labelsList,
  listDrafts,
  listThreads,
  modifyThread,
  profile,
  saveDraftMime,
  sendAsList,
  sendMime,
  threadFull,
  threadMetas,
  trashThread,
  untrashThread,
  watchMailbox,
} from '../_shared/gmail.ts'
import { type Address, inlineImages, parseMessage, resolveBodies, summarize } from '../_shared/parse.ts'
import { type OutgoingAttachment, buildMime, isEmail } from '../_shared/mime.ts'
import { HistoryGone, historySince } from '../_shared/sync.ts'
import { type Account, accountForOwner, updateAccount, userFromRequest } from '../_shared/store.ts'

type Ctx = { account: Account; token: string; self: string[] }
type Body = Record<string, unknown>

const MAX_ATTACHMENTS = 20_000_000
const SYSTEM_COUNTS = ['INBOX', 'DRAFT', 'SPAM', 'STARRED']

const ids = (value: unknown, max = 100): string[] => {
  if (!Array.isArray(value)) throw new HttpError(400, 'bad_request', 'Expected a list of ids.')
  return [...new Set(value.map(String).filter(Boolean))].slice(0, max)
}
const str = (value: unknown) => (typeof value === 'string' ? value : '')
const labelsOf = (value: unknown) => (Array.isArray(value) ? value.map(String).filter((l) => /^[A-Za-z0-9_-]+$/.test(l)) : [])

function addresses(value: unknown, field: string): Address[] {
  if (!Array.isArray(value)) return []
  const out: Address[] = []
  for (const item of value) {
    const email = str((item as Address)?.email).trim()
    const name = str((item as Address)?.name).trim()
    if (!email) continue
    if (!isEmail(email)) throw new HttpError(400, 'bad_address', `"${email}" in ${field} is not a valid email address.`, { field, email })
    out.push({ name, email })
  }
  return out
}

async function summaries(ctx: Ctx, threadIds: string[]) {
  const metas = await threadMetas(ctx.token, threadIds)
  const threads = []
  const missing = []
  for (let i = 0; i < threadIds.length; i++) {
    const meta = metas[i]
    if (meta?.messages?.length) threads.push(summarize(meta, ctx.self))
    else missing.push(threadIds[i])
  }
  return { threads, missing }
}

// ---------- Actions ----------

async function status(userId: string) {
  const pushConfigured = !!optionalEnv('MAIL_PUBSUB_TOPIC')
  const account = await accountForOwner(userId)
  if (!account) return { linked: false, pushConfigured }
  if (account.status === 'needs_reauth') return { linked: true, needsReauth: true, email: account.email, pushConfigured }
  let token: string
  try {
    token = await accessTokenFor(account)
  } catch (err) {
    if (err instanceof ReauthError) return { linked: true, needsReauth: true, email: account.email, pushConfigured }
    throw err
  }
  const [me, sendAs] = await Promise.all([profile(token), sendAsList(token).catch(() => [])])

  // Renew the watch early if it is within a day of expiring, so live updates never lapse
  let watchExpiresAt = account.watch_expires_at
  const topic = optionalEnv('MAIL_PUBSUB_TOPIC')
  if (topic && (!watchExpiresAt || Date.parse(watchExpiresAt) - Date.now() < 86_400_000)) {
    try {
      const watch = await watchMailbox(token, topic)
      watchExpiresAt = new Date(Number(watch.expiration)).toISOString()
      await updateAccount(account.id, { watch_expires_at: watchExpiresAt })
    } catch (err) {
      console.error('Renewing the Gmail watch failed', err)
    }
  }
  const aliases = [...new Set([account.email, ...sendAs.map((s) => s.sendAsEmail.toLowerCase())])]
  if (aliases.join() !== (account.aliases ?? []).join()) await updateAccount(account.id, { aliases })

  return {
    linked: true,
    email: me.emailAddress,
    historyId: me.historyId,
    totals: { messages: me.messagesTotal, threads: me.threadsTotal },
    sendAs: sendAs.map((s) => ({
      email: s.sendAsEmail,
      name: s.displayName ?? '',
      signature: s.signature ?? '',
      isDefault: !!s.isDefault,
    })),
    live: {
      pushConfigured,
      watchExpiresAt,
      lastPushAt: account.last_push_at,
      lastSyncAt: account.last_sync_at,
    },
  }
}

async function labels(ctx: Ctx) {
  const { labels: all = [] } = await labelsList(ctx.token)
  const user = all.filter((l) => l.type === 'user' && l.labelListVisibility !== 'labelHide').slice(0, 60)
  const wanted = [...SYSTEM_COUNTS, ...user.map((l) => l.id)]
  const detailed = await pool(wanted, 8, (id) => labelGet(ctx.token, id).catch(() => null))
  const byId = new Map(detailed.filter(Boolean).map((l) => [l!.id, l!]))
  const shape = (id: string, fallbackName: string) => {
    const l = byId.get(id) ?? all.find((x) => x.id === id)
    return {
      id,
      name: l?.name ?? fallbackName,
      type: l?.type ?? 'system',
      unread: l?.threadsUnread ?? 0,
      total: l?.threadsTotal ?? 0,
      messages: l?.messagesTotal ?? 0,
      color: l?.color?.backgroundColor ?? null,
      textColor: l?.color?.textColor ?? null,
    }
  }
  return {
    system: SYSTEM_COUNTS.map((id) => shape(id, id)),
    user: user.map((l) => shape(l.id, l.name)).sort((a, b) => a.name.localeCompare(b.name)),
  }
}

async function list(ctx: Ctx, body: Body) {
  const res = await listThreads(ctx.token, {
    labelId: str(body.labelId) || undefined,
    q: str(body.q) || undefined,
    pageToken: str(body.pageToken) || undefined,
    max: Number(body.max) || 30,
  })
  const threadIds = (res.threads ?? []).map((t) => t.id)
  const { threads } = await summaries(ctx, threadIds)
  return { threads, nextPageToken: res.nextPageToken ?? null, estimate: res.resultSizeEstimate ?? threads.length }
}

async function thread(ctx: Ctx, body: Body) {
  const id = str(body.id)
  if (!id) throw new HttpError(400, 'bad_request', 'Missing thread id.')
  const [raw, drafts] = await Promise.all([threadFull(ctx.token, id), listDrafts(ctx.token).catch(() => [])])
  const messages = await pool(raw.messages ?? [], 4, async (m) => {
    const fetchData = async (attachmentId: string) => (await attachmentData(ctx.token, m.id, attachmentId)).data
    const parsed = await resolveBodies(parseMessage(m, ctx.self), fetchData)
    return inlineImages(parsed, fetchData)
  })
  const labels = new Set<string>()
  for (const m of messages) for (const l of m.labels) labels.add(l)
  return {
    thread: {
      id: raw.id,
      historyId: raw.historyId ?? null,
      subject: messages.find((m) => !m.draft)?.subject ?? messages[0]?.subject ?? '',
      labels: [...labels],
      messages,
      drafts: drafts.filter((d) => d.message?.threadId === raw.id).map((d) => ({ draftId: d.id, messageId: d.message.id })),
      summary: summarize(raw, ctx.self),
    },
  }
}

async function attachment(ctx: Ctx, body: Body) {
  const messageId = str(body.messageId)
  const attachmentId = str(body.attachmentId)
  if (!messageId || !attachmentId) throw new HttpError(400, 'bad_request', 'Missing attachment details.')
  const res = await attachmentData(ctx.token, messageId, attachmentId)
  return { data: b64urlToB64(res.data), size: res.size }
}

async function modify(ctx: Ctx, body: Body) {
  const threadIds = ids(body.ids)
  const add = labelsOf(body.add)
  const remove = labelsOf(body.remove)
  if (!add.length && !remove.length) throw new HttpError(400, 'bad_request', 'Nothing to change.')
  await pool(threadIds, 6, (id) => modifyThread(ctx.token, id, add, remove))
  return summaries(ctx, threadIds)
}

async function trash(ctx: Ctx, body: Body, undo = false) {
  const threadIds = ids(body.ids)
  await pool(threadIds, 6, (id) => (undo ? untrashThread(ctx.token, id) : trashThread(ctx.token, id)))
  return summaries(ctx, threadIds)
}

// Builds the outgoing message from the page's composer fields
async function compose(ctx: Ctx, body: Body, requireRecipients: boolean) {
  const to = addresses(body.to, 'To')
  const cc = addresses(body.cc, 'Cc')
  const bcc = addresses(body.bcc, 'Bcc')
  if (requireRecipients && !to.length && !cc.length && !bcc.length) {
    throw new HttpError(400, 'no_recipients', 'Add at least one person to send it to.')
  }
  const fromEmail = str(body.fromEmail).toLowerCase() || ctx.account.email
  if (!ctx.self.includes(fromEmail)) throw new HttpError(400, 'bad_from', 'That From address is not set up in Gmail.')

  const files: OutgoingAttachment[] = []
  let total = 0
  for (const item of Array.isArray(body.attachments) ? body.attachments : []) {
    const a = item as Record<string, unknown>
    const data = str(a.data)
    if (!data) continue
    total += b64Size(data)
    files.push({ filename: str(a.filename) || 'attachment', mimeType: str(a.mimeType) || 'application/octet-stream', data })
  }
  // Attachments carried over from the original message when forwarding
  const carried = Array.isArray(body.forwardAttachments) ? body.forwardAttachments.slice(0, 20) : []
  await pool(carried, 4, async (item) => {
    const a = item as Record<string, unknown>
    const messageId = str(a.messageId)
    const attachmentId = str(a.attachmentId)
    if (!messageId || !attachmentId) return
    const res = await attachmentData(ctx.token, messageId, attachmentId)
    total += res.size ?? 0
    files.push({ filename: str(a.filename) || 'attachment', mimeType: str(a.mimeType) || 'application/octet-stream', data: b64urlToB64(res.data) })
  })
  if (total > MAX_ATTACHMENTS) {
    throw new HttpError(413, 'too_large', 'Attachments add up to more than 20 MB. Share large files as a link instead.')
  }

  return buildMime({
    from: { name: str(body.fromName), email: fromEmail },
    to,
    cc,
    bcc,
    subject: str(body.subject),
    html: str(body.html),
    text: str(body.text),
    inReplyTo: str(body.inReplyTo) || null,
    references: str(body.references) || null,
    attachments: files,
  })
}

async function send(ctx: Ctx, body: Body) {
  const mime = await compose(ctx, body, true)
  const threadId = str(body.threadId) || undefined
  const sent = await sendMime(ctx.token, mime, threadId)
  const draftId = str(body.draftId)
  if (draftId) {
    await deleteDraft(ctx.token, draftId).catch((err) => {
      if (!(err instanceof GmailError && err.status === 404)) console.error('Deleting the sent draft failed', err)
    })
  }
  const { threads } = await summaries(ctx, [sent.threadId])
  return { id: sent.id, threadId: sent.threadId, thread: threads[0] ?? null }
}

async function saveDraft(ctx: Ctx, body: Body) {
  const mime = await compose(ctx, body, false)
  const draft = await saveDraftMime(ctx.token, mime, {
    draftId: str(body.draftId) || undefined,
    threadId: str(body.threadId) || undefined,
  })
  return { draftId: draft.id, messageId: draft.message.id, threadId: draft.message.threadId }
}

async function removeDraft(ctx: Ctx, body: Body) {
  const draftId = str(body.draftId)
  if (!draftId) throw new HttpError(400, 'bad_request', 'Missing draft id.')
  try {
    await deleteDraft(ctx.token, draftId)
  } catch (err) {
    if (!(err instanceof GmailError && err.status === 404)) throw err
  }
  return { deleted: true }
}

async function sync(ctx: Ctx, body: Body) {
  const since = str(body.historyId)
  if (!/^\d+$/.test(since)) throw new HttpError(400, 'bad_request', 'Missing history id.')
  try {
    return await historySince(ctx.token, since)
  } catch (err) {
    if (!(err instanceof HistoryGone)) throw err
    const me = await profile(ctx.token)
    return { resync: true, historyId: me.historyId, threadIds: [], newMail: [] }
  }
}

async function watch(ctx: Ctx) {
  const topic = optionalEnv('MAIL_PUBSUB_TOPIC')
  if (!topic) throw new HttpError(400, 'push_off', 'Live updates are not set up yet. Add MAIL_PUBSUB_TOPIC first.')
  const res = await watchMailbox(ctx.token, topic)
  const watchExpiresAt = new Date(Number(res.expiration)).toISOString()
  await updateAccount(ctx.account.id, { watch_expires_at: watchExpiresAt })
  return { watchExpiresAt }
}

const ACTIONS: Record<string, (ctx: Ctx, body: Body) => Promise<unknown>> = {
  labels,
  list,
  threads: (ctx, body) => summaries(ctx, ids(body.ids, 50)),
  thread,
  attachment,
  modify,
  trash: (ctx, body) => trash(ctx, body),
  untrash: (ctx, body) => trash(ctx, body, true),
  send,
  saveDraft,
  deleteDraft: removeDraft,
  sync,
  watch,
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method', message: 'Use POST.' }, 405, cors)
  try {
    const user = await userFromRequest(req)
    const body = (await req.json().catch(() => ({}))) as Body
    const action = str(body.action)
    if (action === 'status') return json(await status(user.id), 200, cors)

    const handler = ACTIONS[action]
    if (!handler) throw new HttpError(400, 'bad_request', `Unknown action "${action}".`)
    const account = await accountForOwner(user.id)
    if (!account) throw new HttpError(404, 'not_linked', 'Link your Gmail first.')
    const token = await accessTokenFor(account)
    const self = [...new Set([account.email, ...(account.aliases ?? [])].map((e) => e.toLowerCase()))]
    return json(await handler({ account, token, self }, body), 200, cors)
  } catch (err) {
    return errorResponse(err, cors)
  }
})
