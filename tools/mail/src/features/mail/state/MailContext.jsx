// Mail state: the linked account, folders, thread lists, open conversations and live updates.
// Every change is shown right away (optimistic) and confirmed or rolled back by the server.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { friendly } from '../api/errors.js'
import { belongs, sortByDate, viewKey } from './views.js'
import { getSettings, setSettings } from './settings.js'
import { useToast } from '../ui/Toast.jsx'
import { nameOf, plural } from '../lib/format.js'
import { base64ToBlob, saveBlob } from '../lib/files.js'

const Ctx = createContext(null)
export const useMail = () => useContext(Ctx)

const initial = {
  phase: 'loading', // loading | unlinked | reauth | ready | error
  error: null,
  account: null,
  pushConfigured: false,
  labels: { system: [], user: [] },
  threads: {},
  lists: {},
  details: {},
  historyId: null,
  realtime: 'connecting', // connecting | live | polling | offline
  lastSyncAt: null,
  fresh: {},
}

const bigger = (a, b) => {
  try {
    return BigInt(a || '0') > BigInt(b || '0')
  } catch {
    return false
  }
}

function applyLabels(summary, add = [], remove = []) {
  const labels = new Set(summary.labels)
  for (const l of remove) labels.delete(l)
  for (const l of add) labels.add(l)
  if (add.includes('TRASH') || add.includes('SPAM')) labels.delete('INBOX')
  return {
    ...summary,
    labels: [...labels],
    unread: labels.has('UNREAD'),
    starred: labels.has('STARRED'),
  }
}

// Puts each changed thread into, or takes it out of, every loaded folder list
function reconcile(lists, threads, changedIds, missing = []) {
  const next = { ...lists }
  for (const [key, list] of Object.entries(lists)) {
    if (!list.loaded) continue
    const [labelId, q] = key.split('|')
    let ids = list.ids
    let touched = false
    if (missing.length) {
      const before = ids.length
      ids = ids.filter((id) => !missing.includes(id))
      touched = touched || ids.length !== before
    }
    if (q) {
      // Searches are asked again; only drop threads that are gone
      if (changedIds.some((id) => ids.includes(id))) next[key] = { ...list, ids, stale: true }
      else if (touched) next[key] = { ...list, ids }
      continue
    }
    for (const id of changedIds) {
      const t = threads[id]
      if (!t) continue
      const inList = ids.includes(id)
      const fits = belongs(t, labelId === '*' ? 'ALL' : labelId)
      if (fits && !inList) {
        const oldest = ids.length ? threads[ids[ids.length - 1]]?.date || 0 : 0
        if (!list.next || t.date >= oldest) {
          ids = [...ids, id]
          touched = true
        }
      } else if (!fits && inList) {
        ids = ids.filter((x) => x !== id)
        touched = true
      } else if (fits && inList) touched = true
    }
    if (touched) next[key] = { ...list, ids: sortByDate(ids, threads) }
  }
  return next
}

function reducer(state, action) {
  switch (action.type) {
    case 'phase':
      return { ...state, phase: action.phase, error: action.error ?? null }
    case 'account':
      return {
        ...state,
        account: action.account,
        pushConfigured: !!action.account?.live?.pushConfigured,
        historyId: bigger(action.account?.historyId, state.historyId) ? action.account.historyId : state.historyId,
      }
    case 'account/details':
      // Never moves historyId: only a sync may do that, or changes in between would be skipped
      return { ...state, account: action.account, pushConfigured: !!action.account?.live?.pushConfigured }
    case 'unlinked':
      return { ...initial, phase: 'unlinked', pushConfigured: action.pushConfigured, realtime: 'connecting' }
    case 'labels':
      return { ...state, labels: action.labels }
    case 'history':
      return bigger(action.historyId, state.historyId) ? { ...state, historyId: action.historyId, lastSyncAt: Date.now() } : { ...state, lastSyncAt: Date.now() }
    case 'realtime':
      return state.realtime === action.status ? state : { ...state, realtime: action.status }
    case 'list/loading': {
      const list = state.lists[action.key] || { ids: [], next: null, loaded: false }
      return { ...state, lists: { ...state.lists, [action.key]: { ...list, loading: true, error: null, more: !!action.more } } }
    }
    case 'list/loaded': {
      const threads = { ...state.threads }
      for (const t of action.threads) threads[t.id] = t
      const prev = state.lists[action.key]
      const ids = action.append ? [...new Set([...(prev?.ids || []), ...action.threads.map((t) => t.id)])] : action.threads.map((t) => t.id)
      return {
        ...state,
        threads,
        lists: {
          ...state.lists,
          [action.key]: { ids, next: action.next, estimate: action.estimate, loaded: true, loading: false, more: false, error: null, stale: false, at: Date.now() },
        },
      }
    }
    case 'list/error': {
      const list = state.lists[action.key] || { ids: [] }
      return { ...state, lists: { ...state.lists, [action.key]: { ...list, loading: false, more: false, error: action.error } } }
    }
    case 'lists/reset':
      return { ...state, lists: {}, details: {}, threads: {} }
    case 'threads/merge': {
      const threads = { ...state.threads }
      const details = { ...state.details }
      for (const t of action.threads) {
        threads[t.id] = t
        const d = details[t.id]
        if (d?.data) {
          const sent = d.data.messages.filter((m) => !m.draft).length
          const drafts = d.data.messages.some((m) => m.draft)
          if (sent !== t.count || drafts !== t.draft) details[t.id] = { ...d, stale: true }
          else details[t.id] = { ...d, data: { ...d.data, historyId: t.historyId, labels: t.labels } }
        }
      }
      for (const id of action.missing || []) {
        delete threads[id]
        delete details[id]
      }
      const ids = action.threads.map((t) => t.id)
      return { ...state, threads, details, lists: reconcile(state.lists, threads, ids, action.missing || []) }
    }
    case 'threads/local': {
      const threads = { ...state.threads }
      const details = { ...state.details }
      for (const id of action.ids) {
        if (threads[id]) threads[id] = applyLabels(threads[id], action.add, action.remove)
        const d = details[id]
        if (d?.data) {
          const msgs = d.data.messages.map((m) => {
            if (m.draft) return m
            const labels = new Set(m.labels)
            for (const l of action.remove || []) labels.delete(l)
            for (const l of action.add || []) labels.add(l)
            return { ...m, labels: [...labels], unread: labels.has('UNREAD') }
          })
          details[id] = { ...d, data: { ...d.data, messages: msgs, labels: threads[id]?.labels || d.data.labels } }
        }
      }
      return { ...state, threads, details, lists: reconcile(state.lists, threads, action.ids) }
    }
    case 'detail/loading':
      return { ...state, details: { ...state.details, [action.id]: { ...(state.details[action.id] || {}), loading: true, error: null } } }
    case 'detail/loaded': {
      const threads = action.data.summary ? { ...state.threads, [action.id]: action.data.summary } : state.threads
      return {
        ...state,
        threads,
        details: { ...state.details, [action.id]: { data: action.data, loading: false, error: null, stale: false } },
        lists: action.data.summary ? reconcile(state.lists, threads, [action.id]) : state.lists,
      }
    }
    case 'detail/error':
      return { ...state, details: { ...state.details, [action.id]: { ...(state.details[action.id] || {}), loading: false, error: action.error } } }
    case 'fresh': {
      const fresh = { ...state.fresh }
      for (const id of action.ids) fresh[id] = Date.now()
      return { ...state, fresh }
    }
    case 'fresh/clear': {
      const fresh = { ...state.fresh }
      for (const id of action.ids) delete fresh[id]
      return { ...state, fresh }
    }
    default:
      return state
  }
}

export function MailProvider({ api, children }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const toast = useToast()
  const stateRef = useRef(state)
  stateRef.current = state

  const active = useRef({ view: { labelId: 'INBOX', q: '' }, filter: null, threadId: null })
  const opener = useRef(() => {})
  const notified = useRef(new Set())
  const pendingIds = useRef(new Set())
  const pendingMail = useRef([])
  const flushTimer = useRef(null)
  const labelsTimer = useRef(null)
  const searchTimer = useRef(null)
  const blobs = useRef(new Map())
  const reloads = useRef(0)

  // Example saved searches, only for the preview
  useEffect(() => {
    const s = getSettings()
    if (s.savedInit) return
    setSettings({
      savedInit: true,
      saved: api.mode === 'demo'
        ? [
            { id: 'clients', name: 'Clients', q: 'label:clients' },
            { id: 'leads', name: 'New leads', q: 'label:leads is:unread' },
          ]
        : [],
    })
  }, [api])

  // ---------- Loading ----------

  const loadLabels = useCallback(async () => {
    try {
      dispatch({ type: 'labels', labels: await api.labels() })
    } catch {
      // counts refresh again on the next change
    }
  }, [api])

  const scheduleLabels = useCallback(() => {
    clearTimeout(labelsTimer.current)
    labelsTimer.current = setTimeout(loadLabels, 600)
  }, [loadLabels])

  const loadList = useCallback(
    async (view, q, { more = false } = {}) => {
      const key = viewKey({ labelId: view.labelId, q })
      const list = stateRef.current.lists[key]
      if (list?.loading) return
      if (more && !list?.next) return
      dispatch({ type: 'list/loading', key, more })
      try {
        const res = await api.list({ labelId: view.labelId || undefined, q: q || undefined, pageToken: more ? list.next : undefined })
        dispatch({ type: 'list/loaded', key, threads: res.threads, next: res.nextPageToken, estimate: res.estimate, append: more })
      } catch (err) {
        dispatch({ type: 'list/error', key, error: friendly(err) })
        if (err?.code === 'reauth') dispatch({ type: 'phase', phase: 'reauth' })
      }
    },
    [api],
  )

  const loadDetail = useCallback(
    async (id) => {
      dispatch({ type: 'detail/loading', id })
      try {
        dispatch({ type: 'detail/loaded', id, data: await api.thread(id) })
      } catch (err) {
        if (err?.code === 'not_found') {
          dispatch({ type: 'threads/merge', threads: [], missing: [id] })
          return
        }
        dispatch({ type: 'detail/error', id, error: friendly(err) })
      }
    },
    [api],
  )

  const refreshThreads = useCallback(
    async (ids) => {
      const unique = [...new Set(ids)].filter(Boolean)
      if (!unique.length) return
      for (let i = 0; i < unique.length; i += 50) {
        const batch = unique.slice(i, i + 50)
        try {
          const res = await api.threads(batch)
          dispatch({ type: 'threads/merge', threads: res.threads, missing: res.missing || [] })
        } catch {
          // the next sync will try again
        }
      }
      // Keep the open conversation current
      const open = active.current.threadId
      const detail = open && stateRef.current.details[open]
      if (open && unique.includes(open) && detail?.stale && !detail.loading) loadDetail(open)
    },
    [api, loadDetail],
  )

  const reloadActive = useCallback(() => {
    const { view, filter } = active.current
    const q = [view.q, filter].filter(Boolean).join(' ')
    loadList(view, q)
  }, [loadList])

  const fullRefresh = useCallback(async () => {
    dispatch({ type: 'lists/reset' })
    loadLabels()
    reloadActive()
    const open = active.current.threadId
    if (open) loadDetail(open)
  }, [loadLabels, reloadActive, loadDetail])

  // ---------- Live changes ----------

  const notifyNew = useCallback(
    (newMail) => {
      const settings = getSettings()
      const threadIds = []
      for (const item of newMail) {
        if (notified.current.has(item.messageId)) continue
        notified.current.add(item.messageId)
        if (!threadIds.includes(item.threadId)) threadIds.push(item.threadId)
      }
      if (!threadIds.length) return
      const summaries = threadIds.map((id) => stateRef.current.threads[id]).filter((t) => t && t.unread && !t.lastFromMe && !t.labels.includes('SPAM'))
      if (!summaries.length) return
      dispatch({ type: 'fresh', ids: summaries.map((t) => t.id) })
      setTimeout(() => dispatch({ type: 'fresh/clear', ids: summaries.map((t) => t.id) }), 9000)
      const first = summaries[0]
      if (settings.toasts) {
        const text = summaries.length === 1 ? `${nameOf(first.from)}: ${first.subject || '(no subject)'}` : `${plural(summaries.length, 'new message', 'new messages')}`
        toast(text, { kind: 'mail', action: { label: 'Open', onClick: () => opener.current(first.id) } })
      }
      if (settings.notify && typeof document !== 'undefined' && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try {
          const n = new Notification(nameOf(first.from), { body: first.subject || first.snippet, tag: first.id })
          n.onclick = () => {
            window.focus()
            opener.current(first.id)
            n.close()
          }
        } catch {
          // some browsers only allow notifications from a service worker
        }
      }
    },
    [toast],
  )

  const handleChanges = useCallback(
    (change) => {
      if (change.historyId) dispatch({ type: 'history', historyId: String(change.historyId) })
      if (change.kind === 'resync' || change.resync) {
        fullRefresh()
        return
      }
      for (const id of change.threadIds || []) pendingIds.current.add(id)
      pendingMail.current.push(...(change.newMail || []))
      clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(async () => {
        const ids = [...pendingIds.current]
        const newMail = pendingMail.current
        pendingIds.current.clear()
        pendingMail.current = []
        await refreshThreads(ids)
        if (newMail.length) notifyNew(newMail)
        scheduleLabels()
        const { view, filter } = active.current
        const q = [view.q, filter].filter(Boolean).join(' ')
        if (q && stateRef.current.lists[viewKey({ labelId: view.labelId, q })]?.stale) {
          clearTimeout(searchTimer.current)
          searchTimer.current = setTimeout(reloadActive, 900)
        }
      }, 220)
    },
    [fullRefresh, refreshThreads, notifyNew, scheduleLabels, reloadActive],
  )

  const syncNow = useCallback(async () => {
    const since = stateRef.current.historyId
    if (stateRef.current.phase !== 'ready' || !since) return
    try {
      const res = await api.sync(since)
      if (res.resync) {
        dispatch({ type: 'history', historyId: res.historyId })
        fullRefresh()
        return
      }
      handleChanges({ ...res, kind: 'changes' })
      dispatch({ type: 'history', historyId: res.historyId })
    } catch (err) {
      if (err?.code === 'reauth') dispatch({ type: 'phase', phase: 'reauth' })
    }
  }, [api, fullRefresh, handleChanges])

  // ---------- Start up ----------

  const start = useCallback(async () => {
    dispatch({ type: 'phase', phase: 'loading' })
    try {
      const status = await api.status()
      if (!status.linked) {
        dispatch({ type: 'unlinked', pushConfigured: !!status.pushConfigured })
        return
      }
      if (status.needsReauth) {
        dispatch({ type: 'account', account: { email: status.email, sendAs: [], live: { pushConfigured: status.pushConfigured } } })
        dispatch({ type: 'phase', phase: 'reauth' })
        return
      }
      dispatch({ type: 'account', account: status })
      dispatch({ type: 'phase', phase: 'ready' })
      loadLabels()
    } catch (err) {
      dispatch({ type: 'phase', phase: 'error', error: friendly(err) })
    }
  }, [api, loadLabels])

  useEffect(() => {
    start()
  }, [start])

  // Realtime while ready, with a polling safety net
  useEffect(() => {
    if (state.phase !== 'ready') return
    let settled = false
    dispatch({ type: 'realtime', status: 'connecting' })
    const fallback = setTimeout(() => {
      if (!settled) dispatch({ type: 'realtime', status: 'polling' })
    }, 9000)
    const off = api.subscribe(
      (event) => handleChanges(event),
      (status) => {
        if (status === 'SUBSCRIBED') {
          settled = true
          const push = stateRef.current.pushConfigured
          dispatch({ type: 'realtime', status: navigator.onLine === false ? 'offline' : push ? 'live' : 'polling' })
          syncNow()
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          dispatch({ type: 'realtime', status: 'polling' })
        }
      },
    )
    const online = () => {
      dispatch({ type: 'realtime', status: stateRef.current.pushConfigured ? 'live' : 'polling' })
      syncNow()
    }
    const offline = () => dispatch({ type: 'realtime', status: 'offline' })
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => {
      clearTimeout(fallback)
      off()
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
    }
  }, [state.phase, api, handleChanges, syncNow])

  useEffect(() => {
    if (state.phase !== 'ready') return
    const every = state.realtime === 'live' ? 120_000 : 20_000
    const timer = setInterval(() => {
      if (!document.hidden) syncNow()
    }, every)
    const wake = () => {
      if (!document.hidden) syncNow()
    }
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', wake)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', wake)
      document.removeEventListener('visibilitychange', wake)
    }
  }, [state.phase, state.realtime, syncNow])

  useEffect(
    () => () => {
      for (const url of blobs.current.values()) if (url?.startsWith?.('blob:')) URL.revokeObjectURL(url)
    },
    [],
  )

  // ---------- Actions ----------

  const act = useCallback(
    async ({ ids, add = [], remove = [], call, done, undo }) => {
      if (!ids.length) return
      dispatch({ type: 'threads/local', ids, add, remove })
      try {
        const res = await call()
        if (res?.threads) dispatch({ type: 'threads/merge', threads: res.threads, missing: res.missing || [] })
        if (done) toast(done, undo ? { action: { label: 'Undo', onClick: undo } } : {})
        scheduleLabels()
      } catch (err) {
        toast(friendly(err), { tone: 'warn' })
        refreshThreads(ids)
      }
    },
    [toast, scheduleLabels, refreshThreads],
  )

  // "Archived" for one conversation, "Archived 3 conversations" for several
  const say = (ids, one, many) => (ids.length === 1 ? one : many.replace('#', String(ids.length)))

  const actions = useMemo(() => {
    const a = {
      setActive(view, filter, threadId) {
        active.current = { view, filter, threadId }
      },
      setOpener(fn) {
        opener.current = fn
      },
      loadList,
      loadMore: (view, q) => loadList(view, q, { more: true }),
      loadDetail,
      refreshThreads,
      syncNow,
      reload: fullRefresh,
      retry: start,

      openThread(id) {
        const s = stateRef.current
        const d = s.details[id]
        const t = s.threads[id]
        if (!d?.data || d.stale || d.error) {
          if (!d?.loading) loadDetail(id)
        }
        if (getSettings().markRead === 'open' && t?.unread) a.markRead([id], true, { quiet: true })
      },

      archive(ids) {
        return act({ ids, remove: ['INBOX'], call: () => api.modify(ids, [], ['INBOX']), done: say(ids, 'Archived', 'Archived # conversations'), undo: () => a.toInbox(ids, true) })
      },
      toInbox(ids, quiet) {
        return act({ ids, add: ['INBOX'], remove: ['TRASH', 'SPAM'], call: () => api.modify(ids, ['INBOX'], ['SPAM']), done: quiet ? null : say(ids, 'Moved to Inbox', 'Moved # conversations to Inbox') })
      },
      trash(ids) {
        return act({ ids, add: ['TRASH'], remove: ['INBOX'], call: () => api.trash(ids), done: say(ids, 'Moved to Trash', 'Moved # conversations to Trash'), undo: () => a.untrash(ids, true) })
      },
      untrash(ids, quiet) {
        return act({ ids, add: ['INBOX'], remove: ['TRASH'], call: () => api.untrash(ids), done: quiet ? null : say(ids, 'Restored', 'Restored # conversations') })
      },
      markRead(ids, read = true, { quiet = false } = {}) {
        return act({
          ids,
          add: read ? [] : ['UNREAD'],
          remove: read ? ['UNREAD'] : [],
          call: () => (read ? api.modify(ids, [], ['UNREAD']) : api.modify(ids, ['UNREAD'], [])),
          done: quiet ? null : read ? say(ids, 'Marked as read', 'Marked # as read') : say(ids, 'Marked as unread', 'Marked # as unread'),
        })
      },
      star(ids, on = true) {
        return act({ ids, add: on ? ['STARRED'] : [], remove: on ? [] : ['STARRED'], call: () => (on ? api.modify(ids, ['STARRED'], []) : api.modify(ids, [], ['STARRED'])) })
      },
      spam(ids, on = true) {
        return act({
          ids,
          add: on ? ['SPAM'] : ['INBOX'],
          remove: on ? ['INBOX'] : ['SPAM'],
          call: () => (on ? api.modify(ids, ['SPAM'], ['INBOX']) : api.modify(ids, ['INBOX'], ['SPAM'])),
          done: on ? say(ids, 'Reported as spam', 'Reported # as spam') : say(ids, 'Moved to Inbox', 'Moved # conversations to Inbox'),
          undo: on ? () => a.spam(ids, false) : null,
        })
      },
      setLabel(ids, labelId, on, name) {
        return act({
          ids,
          add: on ? [labelId] : [],
          remove: on ? [] : [labelId],
          call: () => (on ? api.modify(ids, [labelId], []) : api.modify(ids, [], [labelId])),
          done: name ? `${on ? 'Added' : 'Removed'} ${name}` : null,
        })
      },

      // Sends after the undo window. reopen(payload) brings the composer back on Undo or failure.
      send(payload, { reopen, to } = {}) {
        const seconds = Number(getSettings().undoSeconds) || 0
        let cancelled = false
        const go = async () => {
          if (cancelled) return
          try {
            const res = await api.send(payload)
            if (res.thread) dispatch({ type: 'threads/merge', threads: [res.thread], missing: [] })
            toast('Sent', { action: { label: 'View', onClick: () => opener.current(res.threadId) } })
            scheduleLabels()
          } catch (err) {
            toast(friendly(err), { tone: 'warn' })
            reopen?.(payload)
          }
        }
        if (!seconds) {
          go()
          return
        }
        const timer = setTimeout(go, seconds * 1000)
        toast(`Sending to ${to || 'your recipients'}`, {
          countdown: seconds,
          action: {
            label: 'Undo',
            onClick: () => {
              cancelled = true
              clearTimeout(timer)
              reopen?.(payload)
            },
          },
        })
      },
      async saveDraft(payload) {
        const res = await api.saveDraft(payload)
        scheduleLabels()
        return res
      },
      async deleteDraft(draftId) {
        await api.deleteDraft(draftId)
        scheduleLabels()
      },

      async attachmentUrl(messageId, att) {
        const key = `${messageId}:${att.id}`
        if (blobs.current.has(key)) return blobs.current.get(key)
        const res = await api.attachment(messageId, att.id)
        const mime = res.mimeType || att.mimeType
        const url = URL.createObjectURL(base64ToBlob(res.data, mime))
        blobs.current.set(key, url)
        return url
      },
      async download(messageId, att) {
        if (api.mode === 'demo') {
          toast('Downloads work in the live admin. This one is an example file.')
          return
        }
        try {
          const res = await api.attachment(messageId, att.id)
          saveBlob(base64ToBlob(res.data, att.mimeType), att.filename)
        } catch (err) {
          toast(friendly(err), { tone: 'warn' })
        }
      },

      async link() {
        const returnTo = `${window.location.origin}${window.location.pathname}${window.location.search}#/mail`
        await api.link({ returnTo })
        if (api.mode === 'demo') start()
      },
      async unlink() {
        try {
          await api.unlink()
          dispatch({ type: 'unlinked', pushConfigured: stateRef.current.pushConfigured })
        } catch (err) {
          toast(friendly(err), { tone: 'warn' })
        }
      },
      async renewWatch() {
        try {
          const res = await api.renewWatch()
          dispatch({ type: 'account', account: { ...stateRef.current.account, live: { ...stateRef.current.account?.live, watchExpiresAt: res.watchExpiresAt } } })
          toast('Live updates renewed')
        } catch (err) {
          toast(friendly(err), { tone: 'warn' })
        }
      },
      reloadAll() {
        reloads.current += 1
        return fullRefresh()
      },
      // Fresh account details (watch expiry, last push) for the settings sheet
      async refreshAccount() {
        try {
          const status = await api.status()
          if (status.linked && !status.needsReauth) dispatch({ type: 'account/details', account: status })
          else if (status.needsReauth) dispatch({ type: 'phase', phase: 'reauth' })
        } catch {
          // the sheet keeps what it already shows
        }
      },
    }
    return a
  }, [api, act, loadList, loadDetail, refreshThreads, syncNow, fullRefresh, start, toast, scheduleLabels])

  const value = useMemo(() => ({ ...state, api, actions }), [state, api, actions])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
