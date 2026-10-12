// Marketing does not create its own Supabase client. It uses the admin's one shared client
// (public/admin/supabase.js), so it runs on the same session as the Hub and the other tools.
// It is loaded from the site at run time rather than bundled. The path sits in a variable so
// Vite leaves it alone in dev and in the build.
const SHARED_CLIENT = '/admin/supabase.js'
export const LOGIN_URL = '/admin/login.html'

// Local design work only: `npm run dev:open` skips the sign-in check. Never active in a build.
const skipAuth = import.meta.env.DEV && import.meta.env.VITE_MARKETING_SKIP_AUTH === '1'

let client = null
async function shared() {
  if (!client) client = await import(/* @vite-ignore */ SHARED_CLIENT)
  return client
}

export async function getSession() {
  if (skipAuth) return { user: { email: 'local preview' } }
  const { supabase } = await shared()
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function getToken() {
  if (skipAuth) return null
  const session = await getSession()
  return session?.access_token || null
}

export async function onAuthChange(fn) {
  if (skipAuth) return () => {}
  const { supabase } = await shared()
  const { data } = supabase.auth.onAuthStateChange((_event, session) => fn(session))
  return () => data.subscription.unsubscribe()
}

export async function signOut() {
  if (!skipAuth) {
    const { supabase } = await shared()
    await supabase.auth.signOut()
  }
  window.location.replace(LOGIN_URL)
}

export const toLogin = () => window.location.replace(LOGIN_URL)
