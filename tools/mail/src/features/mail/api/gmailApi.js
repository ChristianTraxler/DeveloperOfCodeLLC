// The live connection: your Gmail through the mail-api and mail-auth Edge Functions, with
// changes pushed over Supabase Realtime. Pass in the admin's existing Supabase client.
//
//   import { supabase } from '../../lib/supabase'   // wherever the admin keeps it
//   const api = createGmailApi({ supabase })
//
// The demo adapter (demoApi.js) has exactly the same methods, so the page never needs to know
// which one it is talking to.
import { MailError } from './errors.js'

export function createGmailApi({ supabase, apiFunction = 'mail-api', authFunction = 'mail-auth' }) {
  if (!supabase?.functions || !supabase?.channel) throw new Error('createGmailApi needs the admin Supabase client')

  async function invoke(fn, body) {
    let result
    try {
      result = await supabase.functions.invoke(fn, { body })
    } catch (err) {
      throw new MailError('network', null, String(err?.message || err))
    }
    const { data, error } = result
    if (!error) return data
    let detail = null
    try {
      detail = await error.context?.json?.()
    } catch {
      // the server did not send JSON
    }
    if (detail?.error) throw new MailError(detail.error, detail.message, detail.detail)
    throw new MailError(error.name === 'FunctionsFetchError' ? 'network' : 'server', null, error.message)
  }

  const call = (action, payload = {}) => invoke(apiFunction, { action, ...payload })

  return {
    mode: 'gmail',

    status: () => call('status'),
    labels: () => call('labels'),
    list: ({ labelId, q, pageToken, max } = {}) => call('list', { labelId, q, pageToken, max }),
    threads: (ids) => call('threads', { ids }),
    thread: (id) => call('thread', { id }).then((r) => r.thread),
    attachment: (messageId, attachmentId) => call('attachment', { messageId, attachmentId }),
    modify: (ids, add = [], remove = []) => call('modify', { ids, add, remove }),
    trash: (ids) => call('trash', { ids }),
    untrash: (ids) => call('untrash', { ids }),
    send: (message) => call('send', message),
    saveDraft: (message) => call('saveDraft', message),
    deleteDraft: (draftId) => call('deleteDraft', { draftId }),
    sync: (historyId) => call('sync', { historyId }),
    renewWatch: () => call('watch'),

    // Sends the browser to Google's consent screen. Google returns to returnTo afterward.
    async link({ returnTo }) {
      const { url } = await invoke(authFunction, { action: 'start', redirectTo: returnTo })
      window.location.assign(url)
      return new Promise(() => {})
    },
    unlink: () => invoke(authFunction, { action: 'disconnect' }),

    // Live changes. onEvent gets { kind, threadIds, newMail, historyId }; onStatus gets the
    // Realtime channel status (SUBSCRIBED, CHANNEL_ERROR, TIMED_OUT, CLOSED).
    subscribe(onEvent, onStatus) {
      let channel = null
      let stopped = false
      ;(async () => {
        const { data } = await supabase.auth.getUser()
        const uid = data?.user?.id
        if (stopped) return
        if (!uid) {
          onStatus('CHANNEL_ERROR')
          return
        }
        // A unique topic per subscriber, so the hub tile and the Mail page never share a channel
        channel = supabase
          .channel(`mail-events:${uid}:${Math.random().toString(36).slice(2, 10)}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mail_events', filter: `owner_id=eq.${uid}` }, (payload) => {
            const row = payload.new || {}
            onEvent({
              kind: row.kind || 'changes',
              threadIds: row.thread_ids || [],
              newMail: row.new_mail || [],
              historyId: row.history_id || null,
            })
          })
          .subscribe((status) => onStatus(status))
      })().catch(() => onStatus('CHANNEL_ERROR'))
      return () => {
        stopped = true
        if (channel) supabase.removeChannel(channel)
      }
    },

    // Remote images load straight from the sender in the live version
    rewriteRemote: null,
  }
}
