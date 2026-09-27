import { useEffect, useRef, useState } from 'react'
import { contact, images, links, nav } from '../content.js'
import { homeSection, pages } from '../site.js'
import ExtLink from './ExtLink.jsx'

// Nav links for any page. Section links point back into the home page, and Shop opens the shop page.
export function navFor(current) {
  const onHome = current === 'home'
  return nav.map((item) =>
    !onHome && item.href === '#shop'
      ? { ...item, href: pages.products, current: current === 'products' }
      : { ...item, href: homeSection(item.href, onHome) },
  )
}

export function Brand({ onHome = true }) {
  return (
    <ExtLink
      href={onHome ? '#top' : pages.home}
      className="brand"
      aria-label={onHome ? 'Developer of Code, back to top' : 'Developer of Code home page'}
    >
      <img src={images.logo} alt="" width="137" height="128" />
      <span className="brand-word">Developer of Code</span>
    </ExtLink>
  )
}

export default function Header({ current = 'home' }) {
  const onHome = current === 'home'
  const onIntake = current === 'intake'
  const items = navFor(current)
  const [solid, setSolid] = useState(false)
  const [open, setOpen] = useState(false)
  const menuButton = useRef(null)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return undefined
    const previous = document.body.style.overflow
    const button = menuButton.current
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
      button?.focus()
    }
  }, [open])

  const close = () => setOpen(false)

  return (
    <>
      <header className="site-header" data-solid={solid}>
        <div className="wrap flex h-[var(--header-h)] items-center justify-between gap-6">
          <Brand onHome={onHome} />
          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-8">
              {items.map((item) => (
                <li key={item.label}>
                  <ExtLink className="nav-link t-nav" href={item.href} aria-current={item.current ? 'page' : undefined}>
                    {item.label}
                  </ExtLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            {onIntake ? (
              <ExtLink href={links.booking} className="btn btn-line btn-sm hidden sm:inline-flex">
                Book a free consultation
              </ExtLink>
            ) : (
              <ExtLink href={links.intake} className="btn btn-solid btn-sm hidden sm:inline-flex">
                <span className="status-dot" aria-hidden="true" />
                Start a project
              </ExtLink>
            )}
            <button
              ref={menuButton}
              type="button"
              className="menu-button t-nav lg:hidden"
              aria-expanded={open}
              aria-controls="site-menu"
              onClick={() => setOpen(true)}
            >
              <span className="menu-icon" aria-hidden="true" />
              Menu
            </button>
          </div>
        </div>
      </header>

      {open && (
        <div id="site-menu" className="menu-panel" role="dialog" aria-modal="true" aria-label="Site menu">
          <div className="wrap flex h-[var(--header-h)] flex-none items-center justify-between">
            <Brand onHome={onHome} />
            <button type="button" className="menu-button t-nav" onClick={close} autoFocus>
              Close
            </button>
          </div>
          <nav aria-label="Menu" className="wrap flex-1 pt-6">
            <ul className="menu-list">
              {[...items, { label: 'Contact', href: homeSection('#contact', onHome) }].map((item) => (
                <li key={item.label}>
                  <ExtLink href={item.href} onClick={close} aria-current={item.current ? 'page' : undefined}>
                    {item.label}
                  </ExtLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="wrap pb-10 pt-8">
            <div className="flex flex-col gap-3 sm:flex-row">
              {!onIntake && (
                <ExtLink href={links.intake} className="btn btn-solid">
                  <span className="status-dot" aria-hidden="true" />
                  Start your project
                </ExtLink>
              )}
              <ExtLink href={links.booking} className="btn btn-line">
                Book a free consultation
              </ExtLink>
            </div>
            <p className="t-small mt-8 text-muted">
              <a className="u-link" href={links.email}>
                {contact.email}
              </a>
              <br />
              <a className="u-link" href={links.phone}>
                {contact.phone}
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  )
}
