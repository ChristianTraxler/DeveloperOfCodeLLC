import { useEffect, useRef } from 'react'

export function useReveal() {
  useEffect(() => {
    // Content is visible at rest. Only sections still below the first screen fade in as they arrive.
    if (!('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const els = [...document.querySelectorAll('.reveal')].filter((e) => e.getBoundingClientRect().top > window.innerHeight)
    els.forEach((e) => e.classList.add('pre'))
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )
    els.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
}

export function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  return (
    <Tag className={`reveal ${className}`} style={{ '--d': `${delay}ms` }} {...rest}>
      {children}
    </Tag>
  )
}

export function SectionHead({ eyebrow, title, lede, tone = 'dark', id }) {
  const muted = tone === 'dark' ? 'text-snow-muted' : 'text-ink-muted'
  const eb = tone === 'dark' ? 'text-lamp' : 'text-lamp-ink'
  return (
    <div className="grid gap-6 md:grid-cols-12 md:items-end">
      <Reveal className="md:col-span-7">
        <p className={`eyebrow ${eb}`}>{eyebrow}</p>
        <h2 id={id} className="display mt-4 text-[2.6rem] sm:text-[3.4rem] lg:text-[4.1rem]">{title}</h2>
      </Reveal>
      {lede && (
        <Reveal delay={120} className={`md:col-span-5 md:pb-2 ${muted}`}>
          <p className="max-w-md text-[16.5px] leading-relaxed">{lede}</p>
        </Reveal>
      )}
    </div>
  )
}

export const Check = ({ className = '' }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-4 w-4 flex-none ${className}`}>
    <path d="M3.2 8.4l3 3 6.6-6.8" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Dash = ({ className = '' }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-4 w-4 flex-none ${className}`}>
    <path d="M4 8h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
  </svg>
)

export const Arrow = ({ className = '' }) => (
  <svg viewBox="0 0 16 16" aria-hidden="true" className={`h-4 w-4 flex-none ${className}`}>
    <path d="M3 8h9.5M9 4.2L12.8 8 9 11.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function LiveDot() {
  return (
    <span className="relative inline-flex h-2 w-2" aria-hidden="true">
      <span className="absolute inset-0 animate-ping rounded-full bg-live/60 motion-reduce:animate-none" />
      <span className="relative h-2 w-2 rounded-full bg-live" />
    </span>
  )
}

// Animates a number toward its target when it changes.
export function useTween(value, ms = 420) {
  const ref = useRef(null)
  const from = useRef(value)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    const fmt = (n) => '$' + Math.round(n).toLocaleString('en-US')
    if (reduce || start === value) { el.textContent = fmt(value); from.current = value; return }
    let raf
    const t0 = performance.now()
    const step = (t) => {
      const p = Math.min(1, (t - t0) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      el.textContent = fmt(start + (value - start) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); from.current = value }
  }, [value, ms])
  return ref
}

export function Money({ value, className = '' }) {
  const ref = useTween(value)
  return <span ref={ref} className={`num ${className}`}>{'$' + value.toLocaleString('en-US')}</span>
}
