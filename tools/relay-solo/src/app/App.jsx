// The Relay Solo tool's shell at /admin/relay-solo/: the admin sign-in gate and the same top bar
// as Mail (back to the Hub, sign out), with the live Relay Solo app filling the rest of the page.
// Relay Solo keeps its own database and its own sign-in, so it runs from its own deployment and
// is shown here in a frame. Set VITE_RELAY_SOLO_URL at build time to point at another deployment.
import { useEffect, useState } from 'react'
import { ArrowLeft, ExternalLink, LogOut } from 'lucide-react'
import { getSession, onAuthChange, signOut, toLogin, LOGIN_URL } from './session.js'

const HUB_URL = '/admin/'
const RELAY_URL = import.meta.env.VITE_RELAY_SOLO_URL || 'https://relay-solo.vercel.app/'
const LINK =
  'inline-flex h-10 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line2 bg-white/[0.02] px-4 text-[14px] font-medium text-bone transition-[background,border-color] duration-150 hover:border-white/30 hover:bg-white/[0.06] max-sm:w-10 max-sm:px-0'
const GHOST =
  'inline-flex h-10 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-[14px] font-medium text-mute transition-colors duration-150 hover:bg-white/[0.06] hover:text-bone max-sm:w-10 max-sm:px-0'

// 64px tall (h-16), the same bar Mail uses.
function TopBar({ email }) {
  return (
    <header className="sticky z-40 border-b border-line bg-ink/75 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex h-16 max-w-none items-center justify-between px-4 sm:px-6">
        <a href={HUB_URL} className="flex items-center gap-3.5" aria-label="Developer of Code admin home">
          <span className="text-[22px] font-extrabold leading-none tracking-[-0.04em] text-ember" style={{ fontStretch: '112%' }}>
            {'</DOC>'}
          </span>
          <span className="hidden h-5 w-px bg-line2 sm:block" />
          <span className="hidden text-[14px] tracking-[0.02em] text-mute sm:block">Admin</span>
        </a>
        <nav className="flex items-center gap-2">
          {email && <span className="mr-2 hidden text-[14px] text-mute md:block">{email}</span>}
          <a href={RELAY_URL} target="_blank" rel="noopener noreferrer" className={GHOST} aria-label="Open Relay Solo in a new tab">
            <ExternalLink size={16} />
            <span className="max-sm:hidden">New tab</span>
          </a>
          <a href={HUB_URL} className={LINK} aria-label="Back to hub">
            <ArrowLeft size={16} />
            <span className="max-sm:hidden">Hub</span>
          </a>
          <button type="button" onClick={signOut} aria-label="Sign out" className={GHOST}>
            <LogOut size={16} />
            <span className="max-sm:hidden">Sign out</span>
          </button>
        </nav>
      </div>
    </header>
  )
}

// Only shows for the moment before the redirect to the admin sign in (or if it is blocked).
function SignedOut() {
  return (
    <main className="mx-auto max-w-[1120px] px-4 pb-24 pt-20 sm:px-6 lg:px-10">
      <h1 className="font-display text-[clamp(44px,11vw,88px)] font-light leading-[0.9]">Sign in to the admin first</h1>
      <p className="mt-6 text-[16px] text-mute" role="status">Taking you to the admin sign in.</p>
      <a href={LOGIN_URL} className="mt-8 inline-flex h-11 items-center rounded-full bg-ember px-5 text-[15px] font-semibold text-[#1c0a02] hover:bg-[#ff6f3a]">
        Open admin sign in
      </a>
    </main>
  )
}

function Shell({ email }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <div className="flex flex-col" style={{ height: '100dvh' }}>
      <TopBar email={email} />
      <main className="relative min-h-0 flex-1">
        {!loaded && (
          <p className="absolute inset-0 grid place-items-center text-[15px] text-mute" role="status">
            Opening Relay Solo
          </p>
        )}
        <iframe
          src={RELAY_URL}
          title="Relay Solo"
          className="absolute inset-0 h-full w-full border-0 transition-opacity duration-200"
          style={{ opacity: loaded ? 1 : 0, background: 'transparent' }}
          allow="clipboard-read; clipboard-write; fullscreen; payment"
          referrerPolicy="strict-origin-when-cross-origin"
          onLoad={() => setLoaded(true)}
        />
      </main>
    </div>
  )
}

export default function App() {
  // checking, then signed-in or signed-out
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    let live = true
    let off = () => {}
    ;(async () => {
      try {
        const s = await getSession()
        if (!live) return
        setSession(s || null)
        if (!s) return toLogin()
        off = await onAuthChange((next) => {
          setSession(next || null)
          if (!next) toLogin()
        })
      } catch {
        if (live) setSession(null)
        toLogin()
      }
    })()
    return () => {
      live = false
      off()
    }
  }, [])

  if (session === undefined) return null
  return session ? <Shell email={session.user?.email} /> : <SignedOut />
}
