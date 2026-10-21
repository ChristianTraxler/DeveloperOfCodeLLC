import { useEffect, useState } from 'react'
import { ArrowUp } from 'lucide-react'

/** Appears once the page has scrolled past the first screen. */
export default function ScrollTop({ hidden }) {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let raf = 0
    const check = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => setShow(window.scrollY > 520))
    }
    check()
    window.addEventListener('scroll', check, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', check)
    }
  }, [])

  const visible = show && !hidden
  return (
    <button
      type="button"
      onClick={() => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
      }}
      aria-label="Back to top"
      tabIndex={visible ? 0 : -1}
      aria-hidden={!visible}
      className={`fixed z-40 grid h-12 w-12 place-items-center rounded-full border border-line2 bg-raised text-bone transition-[opacity,transform,border-color] duration-200 hover:border-ember/70 hover:text-ember ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
      style={{
        right: 'calc(env(safe-area-inset-right, 0px) + 18px)',
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 18px)',
      }}
    >
      <ArrowUp size={19} />
    </button>
  )
}
