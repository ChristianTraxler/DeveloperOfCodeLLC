// The one place Content Queue reads and writes data.
// Today it keeps everything in this browser (localStorage). To move to Supabase,
// swap the load/save functions and the action handlers below for table calls;
// the components only use `useQueue()` and never touch storage directly.
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react'
import { samplePosts } from './samples'
import { DEFAULT_ACCOUNTS, HOME_ACCOUNT, UNKNOWN_ACCOUNT } from './accounts'

const KEY = 'doc.contentQueue.v1'
const PREFS_KEY = 'doc.contentQueue.prefs.v1'
const ACCOUNTS_KEY = 'doc.contentQueue.accounts.v1'

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

export const newId = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`

export function blankPost(overrides = {}) {
  const now = new Date().toISOString()
  return {
    id: newId(),
    title: '',
    notes: '',
    body: '',
    platform: null,
    account: 'doc',
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

function reducer(state, action) {
  const stamp = new Date().toISOString()
  switch (action.type) {
    case 'add':
      return { ...state, posts: [action.post, ...state.posts] }
    case 'update':
      return {
        ...state,
        posts: state.posts.map((p) => (p.id === action.id ? { ...p, ...action.patch, updatedAt: stamp } : p)),
      }
    case 'remove':
      return { ...state, posts: state.posts.filter((p) => p.id !== action.id) }
    case 'restore':
      return { ...state, posts: [action.post, ...state.posts.filter((p) => p.id !== action.post.id)] }
    case 'replaceAll':
      return { ...state, posts: action.posts }
    case 'addAccount':
      return { ...state, accounts: [...state.accounts, action.account] }
    case 'updateAccount':
      return { ...state, accounts: state.accounts.map((a) => (a.id === action.id ? { ...a, ...action.patch, id: a.id } : a)) }
    case 'removeAccount':
      if (action.id === HOME_ACCOUNT) return state
      return { ...state, accounts: state.accounts.filter((a) => a.id !== action.id) }
    case 'prefs':
      return { ...state, prefs: { ...state.prefs, ...action.patch } }
    default:
      return state
  }
}

const DEFAULT_PREFS = { view: 'board', filters: { platform: '', status: '', tag: '', account: '', q: '' }, sort: 'date' }

function init() {
  const stored = safeRead(KEY)
  const prefs = { ...DEFAULT_PREFS, ...(safeRead(PREFS_KEY) || {}) }
  prefs.filters = { ...DEFAULT_PREFS.filters, ...(prefs.filters || {}) }
  const accounts = safeRead(ACCOUNTS_KEY)
  return {
    posts: Array.isArray(stored?.posts) ? stored.posts : samplePosts(),
    accounts: Array.isArray(accounts) && accounts.length ? accounts : DEFAULT_ACCOUNTS,
    prefs,
    saved: !!stored,
  }
}

const Ctx = createContext(null)

export function QueueProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, init)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      if (state.saved) return
    }
    const t = setTimeout(() => safeWrite(KEY, { version: 1, posts: state.posts }), 150)
    return () => clearTimeout(t)
  }, [state.posts, state.saved])

  useEffect(() => {
    safeWrite(PREFS_KEY, state.prefs)
  }, [state.prefs])

  const firstAccounts = useRef(true)
  useEffect(() => {
    if (firstAccounts.current) {
      firstAccounts.current = false
      return
    }
    safeWrite(ACCOUNTS_KEY, state.accounts)
  }, [state.accounts])

  const add = useCallback((post) => dispatch({ type: 'add', post }), [])
  const update = useCallback((id, patch) => dispatch({ type: 'update', id, patch }), [])
  const remove = useCallback((id) => dispatch({ type: 'remove', id }), [])
  const restore = useCallback((post) => dispatch({ type: 'restore', post }), [])
  const resetToSamples = useCallback(() => dispatch({ type: 'replaceAll', posts: samplePosts() }), [])
  const clearAll = useCallback(() => dispatch({ type: 'replaceAll', posts: [] }), [])
  const setPrefs = useCallback((patch) => dispatch({ type: 'prefs', patch }), [])
  const addAccount = useCallback((account) => dispatch({ type: 'addAccount', account }), [])
  const updateAccount = useCallback((id, patch) => dispatch({ type: 'updateAccount', id, patch }), [])
  const removeAccount = useCallback((id) => dispatch({ type: 'removeAccount', id }), [])

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
      allTags,
      add,
      update,
      remove,
      restore,
      resetToSamples,
      clearAll,
      setPrefs,
      addAccount,
      updateAccount,
      removeAccount,
    }),
    [state.posts, state.accounts, accountById, state.prefs, allTags, add, update, remove, restore, resetToSamples, clearAll, setPrefs, addAccount, updateAccount, removeAccount],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useQueue() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useQueue must be used inside <QueueProvider>')
  return v
}
