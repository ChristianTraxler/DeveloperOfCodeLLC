// Preferences for this device, kept in the browser.
import { useCallback, useEffect, useState } from 'react'

const KEY = 'doc-mail-settings'

export const DEFAULT_SETTINGS = {
  images: 'ask', // 'ask' | 'always'
  trusted: [], // senders whose images always show
  markRead: 'open', // 'open' | 'manual'
  undoSeconds: 5, // 0 turns it off
  signature: true,
  toasts: true,
  notify: false, // desktop notifications while the tab is in the background
  shortcuts: true,
  saved: [],
  recent: [],
}

function read() {
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

const subscribers = new Set()
let current = null

export function getSettings() {
  if (!current) current = read()
  return current
}

export function setSettings(patch) {
  current = { ...getSettings(), ...(typeof patch === 'function' ? patch(getSettings()) : patch) }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(current))
  } catch {
    // private windows: the change still applies for this visit
  }
  for (const fn of subscribers) fn(current)
}

export function useSettings() {
  const [value, setValue] = useState(getSettings)
  useEffect(() => {
    subscribers.add(setValue)
    return () => subscribers.delete(setValue)
  }, [])
  const update = useCallback((patch) => setSettings(patch), [])
  return [value, update]
}

export function rememberSearch(q) {
  const text = String(q || '').trim()
  if (!text) return
  setSettings((s) => ({ recent: [text, ...s.recent.filter((r) => r !== text)].slice(0, 6) }))
}
