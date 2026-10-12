import { useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useMedia(query) {
  const [match, setMatch] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false))
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

export const useDesktop = () => useMedia('(min-width: 1024px)')
export const useTablet = () => useMedia('(min-width: 768px)')
export const useFinePointer = () => useMedia('(hover: hover) and (pointer: fine)')
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)')

export function useEscape(handler, active = true) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    if (!active) return
    const on = (e) => {
      if (e.key === 'Escape') ref.current(e)
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [active])
}

let locks = 0
export function useLockBody(active) {
  useLayoutEffect(() => {
    if (!active) return
    locks += 1
    if (locks === 1) document.body.style.overflow = 'hidden'
    return () => {
      locks = Math.max(0, locks - 1)
      if (locks === 0) document.body.style.overflow = ''
    }
  }, [active])
}

export function useOutside(ref, handler, active = true) {
  const cb = useRef(handler)
  cb.current = handler
  useEffect(() => {
    if (!active) return
    const on = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cb.current(e)
    }
    document.addEventListener('pointerdown', on)
    return () => document.removeEventListener('pointerdown', on)
  }, [ref, active])
}

// Re-renders every `ms` so relative times ("2 min ago") stay current
export function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// True while the user is typing somewhere, so single-key shortcuts stay out of the way
export function isTyping(target) {
  const el = target || document.activeElement
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}
