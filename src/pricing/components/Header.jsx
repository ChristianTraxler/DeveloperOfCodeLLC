import { useEffect, useState } from 'react'
import logo from '../assets/logo-mark.webp'
import { site, url } from '../site.config.js'
import { LiveDot } from './ui.jsx'

const nav = [
  ['Work', '/#work'],
  ['Services', '/#services'],
  ['Process', '/#process'],
  ['About', '/#about'],
  ['Pricing', '/pricing.html', 'pricing'],
  ['Video', '/video', 'video'],
  ['Shop', '/#shop'],
  ['Contact', '/#contact'],
]

export default function Header({ current = 'pricing' }) {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    const esc = (e) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [open])

  const href = (h) => (h.startsWith('#') ? h : url(h))

  return (
    <header
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      className={`fixed inset-x-0 top-0 z-50 transition duration-300 ${
        scrolled || open ? 'border-b border-snow/10 bg-night/85 backdrop-blur-md' : 'border-b border-transparent'
      }`}
    >
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <a href={url('/#top')} className="flex items-center gap-2.5 font-semibold tracking-tight">
          <img src={logo} alt="" width="137" height="128" className="h-7 w-auto" />
          <span className="text-[15px]">Developer of Code</span>
          {site.preview && (
            <span className="ml-1 hidden rounded-full border border-lamp/50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-lamp sm:inline">
              Preview
            </span>
          )}
        </a>

        <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
          {nav.map(([label, h, key]) => {
            const here = key === current
            return (
            <a
              key={label}
              href={href(h)}
              aria-current={here ? 'page' : undefined}
              className={`relative py-1.5 text-[14px] font-[540] transition ${
                here ? 'text-snow' : 'text-snow/75 hover:text-snow'
              }`}
            >
              {label}
              {here && <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-lamp" />}
            </a>
          )})}
        </nav>

        <div className="flex items-center gap-2">
          <a href={url(site.intake)} className="hidden items-center gap-2 rounded-full bg-snow px-4 py-2 text-[13px] font-semibold text-dusk transition hover:bg-white sm:inline-flex">
            <LiveDot /> Start a project
          </a>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            className="-mr-2 grid h-11 w-11 place-items-center rounded-full lg:hidden"
          >
            <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
            <span className="relative block h-3 w-5" aria-hidden="true">
              <span className={`absolute left-0 h-px w-5 bg-snow transition ${open ? 'top-1.5 rotate-45' : 'top-0'}`} />
              <span className={`absolute left-0 h-px w-5 bg-snow transition ${open ? 'top-1.5 -rotate-45' : 'top-3'}`} />
            </span>
          </button>
        </div>
      </div>

      <div
        id="mobile-nav"
        hidden={!open}
        className="h-[calc(100dvh-4rem)] overflow-y-auto border-t border-snow/10 bg-night lg:hidden"
      >
        <nav aria-label="Mobile" className="wrap flex flex-col py-6">
          {nav.map(([label, h, key]) => {
            const here = key === current
            return (
            <a
              key={label}
              href={href(h)}
              onClick={() => setOpen(false)}
              aria-current={here ? 'page' : undefined}
              className="display flex items-center justify-between border-b border-snow/10 py-4 text-[2rem]"
            >
              {label}
              {here && <span className="eyebrow font-sans text-lamp">You are here</span>}
            </a>
          )})}
          <a href={url(site.intake)} className="btn-snow mt-8">Start your project</a>
          <a href={url(site.consult)} className="btn-ghost mt-3">Book a free consultation</a>
        </nav>
      </div>
    </header>
  )
}
