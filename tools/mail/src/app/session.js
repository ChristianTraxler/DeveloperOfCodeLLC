// Mail does not create its own Supabase client. It uses the admin's one shared client
// (public/admin/supabase.js), so it runs on the same session as the Hub and the other tools,
// and the mail-* Edge Functions see the same admin login. It is loaded from the site at run time
// rather than bundled. The path sits in a variable so Vite leaves it alone in dev and in the build.
const SHARED_CLIENT = '/admin/supabase.js'
export const LOGIN_URL = '/admin/login.html'

let client = null
async function shared() {
  if (!client) client = await import(/* @vite-ignore */ SHARED_CLIENT)
  return client
}

export async function getClient() {
  const { supabase } = await shared()
  return supabase
}

export async function getSession() {
  const supabase = await getClient()
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function onAuthChange(fn) {
  const supabase = await getClient()
  const { data } = supabase.auth.onAuthStateChange((_event, session) => fn(session))
  return () => data.subscription.unsubscribe()
}

export async function signOut() {
  const supabase = await getClient()
  await supabase.auth.signOut()
  window.location.replace(LOGIN_URL)
}

export const toLogin = () => window.location.replace(LOGIN_URL)
