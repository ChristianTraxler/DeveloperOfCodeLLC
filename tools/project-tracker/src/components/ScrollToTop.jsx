import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'

export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handleClick = () => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed right-4 sm:right-6 z-40 w-11 h-11 rounded-xl bg-ink-900/95 backdrop-blur-md border border-accent/40 text-accent shadow-lg shadow-accent/10 flex items-center justify-center transition-all duration-200 hover:border-accent hover:bg-ink-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950 ${
        visible ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'
      }`}
      style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
    >
      <ChevronUp size={20} strokeWidth={2.5} aria-hidden="true" />
    </button>
  )
}
