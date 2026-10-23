import { useEffect, useRef, useState } from 'react'
import { contact, images, links, nav } from '../content.js'
import { homeSection, pages } from '../site.js'
import ExtLink from './ExtLink.jsx'

// Nav links for any page. Section links point back into the home page, and Shop opens the shop page.
export function navFor(current) {
  const onHome = current === 'home'
  return nav.map((item) =>
    item.href.startsWith('/')
      ? { ...item, current: current === item.label.toLowerCase() }
      : !onHome && item.href === '#shop'
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
  // shown mounts the island; open drives the morph, so closing can play out before it unmounts.
  const [shown, setShown] = useState(false)
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)
  const menuButton = useRef(null)

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!shown) return undefined
    const previous = document.body.style.overflow
    const button = menuButton.current
    document.body.style.overflow = 'hidden'
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    // The island is pinned to where the pill was, so a rotate or resize closes it instead of leaving it misplaced.
    // Only width counts: mobile browsers fire resize when the address bar shows or hides.
    const width = window.innerWidth
    const onResize = () => {
      if (window.innerWidth !== width) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onResize)
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setOpen(true)))
    return () => {
      cancelAnimationFrame(frame)
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onResize)
      button?.focus()
    }
  }, [shown])

  useEffect(() => {
    if (open || !shown) return undefined
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timer = setTimeout(() => setShown(false), reduce ? 160 : 460)
    return () => clearTimeout(timer)
  }, [open, shown])

  // The island grows out of the Menu pill, so it starts from the pill's exact spot and size.
  const openMenu = () => {
    const rect = menuButton.current.getBoundingClientRect()
    setAnchor({
      '--island-top': `${rect.top}px`,
      '--island-right': `${window.innerWidth - rect.right}px`,
      '--pill-w': `${rect.width}px`,
      '--pill-h': `${rect.height}px`,
    })
    setShown(true)
  }

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
              onClick={openMenu}
            >
              <span className="menu-icon" aria-hidden="true" />
              Menu
            </button>
          </div>
        </div>
      </header>

      {shown && (
        <div className="island-root" data-open={open}>
          <div className="island-scrim" aria-hidden="true" onClick={close} />
          <div id="site-menu" className="island" style={anchor} role="dialog" aria-modal="true" aria-label="Site menu">
            <div className="island-top">
              <span className="island-label t-nav">Menu</span>
              <button type="button" className="menu-button island-close t-nav" onClick={close} autoFocus>
                <span className="island-x" aria-hidden="true" />
                Close
              </button>
            </div>
            <nav aria-label="Menu" className="island-body">
              <ul className="menu-list">
                {items.map((item, index) => (
                  <li key={item.label} style={{ '--i': index }}>
                    <ExtLink href={item.href} onClick={close} aria-current={item.current ? 'page' : undefined}>
                      {item.label}
                    </ExtLink>
                  </li>
                ))}
              </ul>
            </nav>
            <div className="island-foot">
              <div className="flex flex-col gap-3">
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
              <p className="t-small mt-6 text-muted">
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
        </div>
      )}
    </>
  )
}
