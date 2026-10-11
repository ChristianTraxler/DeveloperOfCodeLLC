// Undo and redo for the email being edited. Rapid typing in one field counts as one step.
import { useCallback, useEffect, useRef, useState } from 'react'

export function useHistory(campaign, commit) {
  const current = useRef(campaign)
  current.current = campaign
  const h = useRef({ past: [], future: [], key: null, at: 0 })
  const [, bump] = useState(0)

  const change = useCallback(
    (updater, key) => {
      const prev = current.current
      if (!prev) return
      const next = typeof updater === 'function' ? updater(prev) : { ...prev, ...updater }
      if (!next || next === prev) return
      const now = Date.now()
      const stack = h.current
      if (!(key && key === stack.key && now - stack.at < 900)) {
        stack.past.push(prev)
        if (stack.past.length > 80) stack.past.shift()
      }
      stack.future = []
      stack.key = key || null
      stack.at = now
      current.current = next
      commit(next)
      bump((n) => n + 1)
    },
    [commit],
  )

  const undo = useCallback(() => {
    const stack = h.current
    if (!stack.past.length) return false
    stack.future.push(current.current)
    const prev = stack.past.pop()
    stack.key = null
    current.current = prev
    commit(prev)
    bump((n) => n + 1)
    return true
  }, [commit])

  const redo = useCallback(() => {
    const stack = h.current
    if (!stack.future.length) return false
    stack.past.push(current.current)
    const next = stack.future.pop()
    stack.key = null
    current.current = next
    commit(next)
    bump((n) => n + 1)
    return true
  }, [commit])

  // Keyboard: Cmd or Ctrl + Z, and Shift for redo. Text fields keep their own undo.
  useEffect(() => {
    const on = (e) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const el = e.target
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (typing) return
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
      } else if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        redo()
      }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [undo, redo])

  return { change, undo, redo, canUndo: h.current.past.length > 0, canRedo: h.current.future.length > 0 }
}
