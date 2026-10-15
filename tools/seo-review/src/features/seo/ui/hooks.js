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

export function useReducedMotion() {
  return useMedia('(prefers-reduced-motion: reduce)')
}
