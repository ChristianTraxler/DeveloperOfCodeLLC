// The one place Content Queue reads and writes data.
// Posts and businesses are saved to the signed-in account in Supabase (supabase/content-queue.sql),
// so every device sees the same queue. Changes show here at once and are written in the background;
// Realtime brings in changes made on other devices. View and filter choices stay on each device.
// The components only use `useQueue()` and never touch storage directly.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { supabase } from './client'
import { DEFAULT_ACCOUNTS, HOME_ACCOUNT, UNKNOWN_ACCOUNT } from './accounts'

const PREFS_KEY = 'doc.contentQueue.prefs.v1'

function safeRead(key) {
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
function safeWrite(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
    return true
  } catch {
    return false
  }
}

export const newId = () => crypto.randomUUID()

export function blankPost(overrides = {}) {
  const now = new Date().toISOString()
  return {
    id: newId(),
    title: '',
    notes: '',
    body: '',
    platform: null,
    account: HOME_ACCOUNT,
    imageUrl: '',
    scheduledAt: null,
    status: 'idea',
    tags: [],
    liveUrl: '',
    postedAt: null,
    promo: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

/* ---------- Rows <-> app objects ---------- */

const POST_COLUMNS = {
  id: 'id',
  title: 'title',
  notes: 'notes',
  body: 'body',
  platform: 'platform',
  account: 'account',
  imageUrl: 'image_url',
  scheduledAt: 'scheduled_at',
  status: 'status',
  tags: 'tags',
  liveUrl: 'live_url',
  postedAt: 'posted_at',
  promo: 'promo',
  createdAt: 'created_at',
}
const ACCOUNT_COLUMNS = { id: 'key', name: 'name', handle: 'handle', initials: 'initials', about: 'about', site: 'site', sort: 'sort' }

const toRow = (obj, columns) => Object.fromEntries(Object.entries(columns).filter(([k]) => k in obj).map(([k, col]) => [col, col === 'tags' ? obj[k] || [] : obj[k]]))

function postFromRow(r) {
  const p = { updatedAt: r.updated_at }
  for (const [k, col] of Object.entries(POST_COLUMNS)) p[k] = r[col]
  p.tags = p.tags || []
  return p
}
function accountFromRow(r) {
  const a = {}
  for (const [k, col] of Object.entries(ACCOUNT_COLUMNS)) a[k] = r[col]
  return a
}

const byCreatedDesc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')
const bySort = (a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name)

/* ---------- Local state ---------- */

function upsert(list, item, key = 'id') {
  const i = list.findIndex((x) => x[key] === item[key])
  if (i < 0) return [item, ...list]
  const next = list.slice()
  next[i] = { ...list[i], ...item }
  return next
}

function reducer(state, action) {
  const stamp = new Date().toISOString()
  switch (action.type) {
    case 'loaded':
      return { ...state, posts: action.posts, accounts: action.accounts, status: 'ready', error: '' }
    case 'status':
      return { ...state, status: action.status, error: action.error ?? state.error }
    case 'error':
      return { ...state, error: action.error }
    case 'add':
      return { ...state, posts: [action.post, ...state.posts.filter((p) => p.id !== action.post.id)] }
    case 'update':
      return {
        ...state,
        posts: state.posts.map((p) => (p.id === action.id ? { ...p, ...action.patch, updatedAt: stamp } : p)),
      }
    case 'remove':
      return { ...state, posts: state.posts.filter((p) => p.id !== action.id) }
    // From Realtime: a change from another device, or the echo of one made here.
    case 'remotePost':
      return { ...state, posts: upsert(state.posts, action.post).sort(byCreatedDesc) }
    case 'remoteAccount':
      return { ...state, accounts: upsert(state.accounts, action.account).sort(bySort) }
    case 'removeAccountLocal':
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) }
    case 'addAccount':
      return { ...state, accounts: [...state.accounts.filter((a) => a.id !== action.account.id), action.account] }
    case 'updateAccount':
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.id ? { ...a, ...action.patch, id: a.id } : a)) }
    case 'prefs':
      return { ...state, prefs: { ...state.prefs, ...action.patch } }
    default:
      return state
  }
}

const DEFAULT_PREFS = { view: 'board', filters: { platform: '', status: '', tag: '', account: '', q: '' }, sort: 'date' }

function init() {
  const prefs = { ...DEFAULT_PREFS, ...(safeRead(PREFS_KEY) || {}) }
  prefs.filters = { ...DEFAULT_PREFS.filters, ...(prefs.filters || {}) }
  return { posts: [], accounts: [], prefs, status: 'loading', error: '' }
}

/* ---------- Supabase ---------- */

const postsTable = () => supabase.from('content_posts')
const accountsTable = () => supabase.from('content_accounts')

async function must(query) {
  const { data, error } = await query
  if (error) throw error
  return data
}

async function fetchAll() {
  const [posts, accounts] = await Promise.all([
    must(postsTable().select('*').order('created_at', { ascending: false })),
    must(accountsTable().select('*').order('sort').order('name')),
  ])
  let list = accounts
  // First visit on this account: start the business list with the studio and current clients.
  // ignoreDuplicates keeps two devices opening at once from clashing.
  if (!list.length) {
    await must(
      supabase
        .from('content_accounts')
        .upsert(DEFAULT_ACCOUNTS.map((a, i) => toRow({ ...a, sort: i }, ACCOUNT_COLUMNS)), { onConflict: 'user_id,key', ignoreDuplicates: true }),
    )
    list = await must(accountsTable().select('*').order('sort').order('name'))
  }
  return { posts: posts.map(postFromRow), accounts: list.map(accountFromRow) }
}

const Ctx = createContext(null)

export function QueueProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const accountsRef = useRef(state.accounts)
  accountsRef.current = state.accounts

  const reload = useCallback(async () => {
    try {
      dispatch({ type: 'loaded', ...(await fetchAll()) })
    } catch (e) {
      dispatch({ type: 'status', status: 'error', error: 'The queue could not load. Check your connection and try again.' })
      console.error('Content Queue load failed', e)
    }
  }, [])

  // Runs a write. The screen already shows the change; if the write fails, say so and reload
  // so the screen matches what is saved.
  const write = useCallback(
    async (query) => {
      try {
        await must(query)
      } catch (e) {
        console.error('Content Queue save failed', e)
        dispatch({ type: 'error', error: 'A change did not save. The queue was reloaded to match what is saved.' })
        reload()
      }
    },
    [reload],
  )

  useEffect(() => {
    reload()
    // Catch up when the tab comes back, in case a live update was missed while it slept.
    const onVisible = () => document.visibilityState === 'visible' && reload()
    document.addEventListener('visibilitychange', onVisible)
    const channel = supabase
      .channel('content-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_posts' }, (m) => {
        if (m.eventType === 'DELETE') dispatch({ type: 'remove', id: m.old.id })
        else dispatch({ type: 'remotePost', post: postFromRow(m.new) })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_accounts' }, (m) => {
        if (m.eventType === 'DELETE') {
          // A delete only carries the row id, so find the business by it after a reload.
          reload()
        } else dispatch({ type: 'remoteAccount', account: accountFromRow(m.new) })
      })
      .subscribe()
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      supabase.removeChannel(channel)
    }
  }, [reload])

  useEffect(() => {
    safeWrite(PREFS_KEY, state.prefs)
  }, [state.prefs])

  const add = useCallback(
    (post) => {
      dispatch({ type: 'add', post })
      write(postsTable().insert(toRow(post, POST_COLUMNS)))
    },
    [write],
  )
  const update = useCallback(
    (id, patch) => {
      dispatch({ type: 'update', id, patch })
      const row = toRow(patch, POST_COLUMNS)
      delete row.id
      delete row.created_at
      if (Object.keys(row).length) write(postsTable().update(row).eq('id', id))
    },
    [write],
  )
  const remove = useCallback(
    (id) => {
      dispatch({ type: 'remove', id })
      write(postsTable().delete().eq('id', id))
    },
    [write],
  )
  // Undo of a delete: put the same post back.
  const restore = useCallback(
    (post) => {
      dispatch({ type: 'add', post })
      write(postsTable().upsert(toRow(post, POST_COLUMNS)))
    },
    [write],
  )
  const setPrefs = useCallback((patch) => dispatch({ type: 'prefs', patch }), [])

  const addAccount = useCallback(
    (account) => {
      const sort = Math.max(0, ...accountsRef.current.map((a) => a.sort ?? 0)) + 1
      const full = { ...account, sort }
      dispatch({ type: 'addAccount', account: full })
      write(accountsTable().insert(toRow(full, ACCOUNT_COLUMNS)))
    },
    [write],
  )
  const updateAccount = useCallback(
    (id, patch) => {
      dispatch({ type: 'updateAccount', id, patch })
      const row = toRow(patch, ACCOUNT_COLUMNS)
      delete row.key
      write(accountsTable().update(row).eq('key', id))
    },
    [write],
  )
  const removeAccount = useCallback(
    (id) => {
      if (id === HOME_ACCOUNT) return
      dispatch({ type: 'removeAccountLocal', id })
      write(accountsTable().delete().eq('key', id))
    },
    [write],
  )
  const dismissError = useCallback(() => dispatch({ type: 'error', error: '' }), [])

  // Every lookup goes through this, so a post whose business was removed still renders.
  const accountById = useMemo(() => {
    const map = Object.fromEntries(state.accounts.map((a) => [a.id, a]))
    return (id) => map[id] || UNKNOWN_ACCOUNT
  }, [state.accounts])

  const allTags = useMemo(() => {
    const counts = new Map()
    for (const p of state.posts) for (const t of p.tags || []) counts.set(t, (counts.get(t) || 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t)
  }, [state.posts])

  const value = useMemo(
    () => ({
      posts: state.posts,
      accounts: state.accounts,
      accountById,
      prefs: state.prefs,
      status: state.status,
      error: state.error,
      allTags,
      add,
      update,
      remove,
      restore,
      reload,
      dismissError,
      setPrefs,
      addAccount,
      updateAccount,
      removeAccount,
    }),
    [state.posts, state.accounts, accountById, state.prefs, state.status, state.error, allTags, add, update, remove, restore, reload, dismissError, setPrefs, addAccount, updateAccount, removeAccount],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useQueue() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useQueue must be used inside <QueueProvider>')
  return v
}
