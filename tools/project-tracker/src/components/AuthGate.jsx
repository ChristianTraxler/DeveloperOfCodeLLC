import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const LOGIN_URL = '/admin/login.html'

// Blocks the app until a Supabase session is confirmed. No session → back to
// login. This is UX only; the real protection is RLS on the database, which
// rejects unauthenticated queries even if someone reaches this app directly.
export default function AuthGate({ children }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return
      if (session) setReady(true)
      else window.location.replace(LOGIN_URL)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) window.location.replace(LOGIN_URL)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-muted font-mono text-sm">
        Checking access…
      </div>
    )
  }

  return children
}
