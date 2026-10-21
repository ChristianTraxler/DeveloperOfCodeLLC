// The Mail tool's shell at /admin/mail/: the admin sign-in gate, a top bar back to the Hub,
// and hash routes (#/f/SENT, #/f/INBOX/t/<id>, ...) handed to the feature in src/features/mail.
// Mail talks to Gmail through the mail-* Supabase Edge Functions on the admin's shared client.
import { useEffect, useMemo, useState } from 'react'
import { MotionConfig } from 'framer-motion'
import { ArrowLeft, LogOut } from 'lucide-react'
import { MailTool, createGmailApi } from '../features/mail/index.js'
import { getClient, getSession, onAuthChange, signOut, toLogin, LOGIN_URL } from './session.js'

const HUB_URL = '/admin/'
const LINK =
  'inline-flex h-11 select-none items-center justify-center gap-2 whitespace-nowrap rounded-full border border-line2 bg-white/[0.03] px-4 text-[14px] font-medium text-bone transition-[background,border-color] duration-150 hover:border-white/30 hover:bg-white/[0.07] max-sm:w-11 max-sm:px-0'

function useHashRoute() {
  const read = () => (window.location.hash || '').replace(/^#\/?/, '')
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  const go = (next) => {
    const hash = next ? `#/${next}` : '#/'
    if (window.location.hash !== hash) window.location.hash = hash
    setRoute(next)
  }
  return [route, go]
}

// 64px tall (h-16), which is the --ml-top default Mail sizes its desktop layout against.
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
          <a href={HUB_URL} className={LINK} aria-label="Back to hub">
            <ArrowLeft size={16} />
            <span className="max-sm:hidden">Hub</span>
          </a>
          <button type="button" onClick={signOut} aria-label="Sign out" className={LINK}>
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

function Shell({ email, supabase }) {
  const [route, go] = useHashRoute()
  const api = useMemo(() => createGmailApi({ supabase }), [supabase])
  return (
    <>
      <TopBar email={email} />
      <MailTool api={api} path={route} navigate={go} />
    </>
  )
}

export default function App() {
  // checking, then signed-in or signed-out
  const [session, setSession] = useState(undefined)
  const [supabase, setSupabase] = useState(null)

  useEffect(() => {
    let live = true
    let off = () => {}
    ;(async () => {
      try {
        const [client, s] = await Promise.all([getClient(), getSession()])
        if (!live) return
        setSupabase(client)
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
  return (
    <MotionConfig reducedMotion="user">
      {session && supabase ? <Shell email={session.user?.email} supabase={supabase} /> : <SignedOut />}
    </MotionConfig>
  )
}
