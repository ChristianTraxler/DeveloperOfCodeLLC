// mail-push: Google Pub/Sub calls this the moment anything changes in the linked mailbox.
//
// The push subscription's endpoint is
//   https://<project-ref>.supabase.co/functions/v1/mail-push?token=<MAIL_PUSH_TOKEN>
// Pub/Sub sends { message: { data: base64({ emailAddress, historyId }) } }. This reads what
// changed since the last stored history id and writes one mail_events row, which Realtime
// delivers to the open Mail page.
//
// Any 2xx tells Pub/Sub the message was handled. A 500 makes Pub/Sub retry with backoff,
// which is what we want for a brief Gmail or network hiccup.
import { env } from '../_shared/env.ts'
import { b64urlDecode, safeEqual } from '../_shared/base64.ts'
import { ReauthError } from '../_shared/google.ts'
import { accountByEmail, updateAccount } from '../_shared/store.ts'
import { syncAccount } from '../_shared/sync.ts'

const done = () => new Response(null, { status: 204 })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('ok')
  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!safeEqual(token, env('MAIL_PUSH_TOKEN'))) return new Response('forbidden', { status: 403 })

  let note: { emailAddress?: string; historyId?: string | number } | null = null
  try {
    const body = await req.json()
    // Gmail documents the data as base64url and Pub/Sub as base64. This reads either.
    note = JSON.parse(new TextDecoder().decode(b64urlDecode(String(body?.message?.data ?? ''))))
  } catch {
    return done()
  }
  const email = String(note?.emailAddress ?? '').toLowerCase()
  if (!email) return done()

  const account = await accountByEmail(email)
  if (!account || account.status !== 'active') return done()

  try {
    await updateAccount(account.id, { last_push_at: new Date().toISOString() })
    await syncAccount(account, note?.historyId != null ? String(note.historyId) : undefined)
    return done()
  } catch (err) {
    if (err instanceof ReauthError) return done()
    console.error('mail-push sync failed', err)
    return new Response('retry', { status: 500 })
  }
})
