// Reads what changed in a mailbox since a history id, and records it in the change feed.
import { accessTokenFor } from './google.ts'
import { GmailError, history, profile } from './gmail.ts'
import { type Account, type NewMail, accountById, recordEvent, updateAccount } from './store.ts'

export class HistoryGone extends Error {}

export type Changes = { historyId: string; threadIds: string[]; newMail: NewMail[] }

const newer = (a: string | null | undefined, b: string | null | undefined) => {
  try {
    return BigInt(a ?? '0') > BigInt(b ?? '0')
  } catch {
    return false
  }
}

// Every thread touched since startHistoryId, plus the messages that just landed in the inbox
export async function historySince(token: string, startHistoryId: string): Promise<Changes> {
  const threads = new Set<string>()
  const newMail: NewMail[] = []
  let latest = startHistoryId
  let pageToken: string | undefined
  let pages = 0
  try {
    do {
      const res = await history(token, startHistoryId, pageToken)
      for (const h of res.history ?? []) {
        for (const m of h.messages ?? []) threads.add(m.threadId)
        for (const a of h.messagesAdded ?? []) {
          threads.add(a.message.threadId)
          const labels = a.message.labelIds ?? []
          if (labels.includes('INBOX') && !labels.includes('SENT') && !labels.includes('DRAFT')) {
            newMail.push({ messageId: a.message.id, threadId: a.message.threadId })
          }
        }
        for (const d of h.messagesDeleted ?? []) threads.add(d.message.threadId)
        for (const l of h.labelsAdded ?? []) threads.add(l.message.threadId)
        for (const l of h.labelsRemoved ?? []) threads.add(l.message.threadId)
      }
      if (newer(res.historyId, latest)) latest = res.historyId as string
      pageToken = res.nextPageToken
      pages++
    } while (pageToken && pages < 20)
  } catch (err) {
    // Gmail keeps history for about a week. Older ids return 404 and need a full reload.
    if (err instanceof GmailError && err.status === 404) throw new HistoryGone()
    throw err
  }
  return { historyId: latest, threadIds: [...threads], newMail }
}

// Used by mail-push and mail-cron: advance the account's stored history id and write one
// mail_events row, which Realtime delivers to the open Mail page.
export async function syncAccount(account: Account, notifiedHistoryId?: string): Promise<'init' | 'skip' | 'none' | 'changes' | 'resync'> {
  const token = await accessTokenFor(account)
  const now = new Date().toISOString()
  if (!account.history_id) {
    const p = await profile(token)
    await updateAccount(account.id, { history_id: p.historyId, last_sync_at: now })
    return 'init'
  }
  if (notifiedHistoryId && !newer(notifiedHistoryId, account.history_id)) return 'skip'

  let changes: Changes
  try {
    changes = await historySince(token, account.history_id)
  } catch (err) {
    if (!(err instanceof HistoryGone)) throw err
    const p = await profile(token)
    await updateAccount(account.id, { history_id: p.historyId, last_sync_at: now })
    await recordEvent(account, { kind: 'resync', threadIds: [], newMail: [], historyId: p.historyId })
    return 'resync'
  }

  // Another run may have moved further ahead in the meantime. Only ever move forward.
  const current = await accountById(account.id)
  if (current && newer(changes.historyId, current.history_id)) {
    await updateAccount(account.id, { history_id: changes.historyId, last_sync_at: now })
  } else {
    await updateAccount(account.id, { last_sync_at: now })
  }
  if (!changes.threadIds.length) return 'none'
  await recordEvent(account, { kind: 'changes', threadIds: changes.threadIds, newMail: changes.newMail, historyId: changes.historyId })
  return 'changes'
}
