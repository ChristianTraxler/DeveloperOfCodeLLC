import { useEffect, useRef, useState } from 'react'

const RADIUS = 24
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

// Appears after the hero. The ring fills with lamp light as you read, and a tap brings you back up.
export default function ScrollTop() {
  const [visible, setVisible] = useState(false)
  const ring = useRef(null)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const max = document.documentElement.scrollHeight - window.innerHeight
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0
      if (ring.current) ring.current.style.strokeDashoffset = String(CIRCUMFERENCE * (1 - progress))
      setVisible(window.scrollY > window.innerHeight * 0.6)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [])

  const backToTop = () => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
    document.querySelector('main h1')?.focus({ preventScroll: true })
  }

  return (
    <div className="to-top-dock" data-visible={visible}>
      <button
        type="button"
        className="to-top"
        onClick={backToTop}
        aria-label="Scroll to top"
        title="Scroll to top"
        tabIndex={visible ? 0 : -1}
      >
        <svg className="to-top-ring" viewBox="0 0 52 52" aria-hidden="true">
          <circle className="to-top-track" cx="26" cy="26" r={RADIUS} />
          <circle
            ref={ring}
            className="to-top-fill"
            cx="26"
            cy="26"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE}
          />
        </svg>
        <svg className="to-top-arrow" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path
            d="M10 15.5V4.5M5 9.5l5-5 5 5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
