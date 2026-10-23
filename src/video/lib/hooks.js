import { useEffect, useRef, useState } from 'react'

export function useReducedMotion() {
  const query = '(prefers-reduced-motion: reduce)'
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

// True once (or while, with `once: false`) the element is on screen.
export function useInView({ once = true, rootMargin = '0px 0px -10% 0px', threshold = 0.15 } = {}) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setInView(entry.isIntersecting)
        if (entry.isIntersecting && once) io.disconnect()
      },
      { rootMargin, threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [once, rootMargin, threshold])
  return [ref, inView]
}

// Phones and tablets without a mouse get tap-to-play instead of hover-to-play.
export function useCanHover() {
  const [can, setCan] = useState(() => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(hover: hover) and (pointer: fine)')
    const on = () => setCan(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return can
}

// Skip autoplay for visitors on data saver.
export function prefersSaveData() {
  return typeof navigator !== 'undefined' && Boolean(navigator.connection && navigator.connection.saveData)
}
