// mail-cron: pg_cron calls this every few hours (see supabase/cron.sql).
//
// For each linked account it renews the Gmail watch (Google stops sending changes after 7 days
// without a renewal) and catches up on anything a push might have missed. Then it removes old
// rows from the change feed. Requires the x-cron-secret header to match MAIL_CRON_SECRET.
import { env, optionalEnv } from '../_shared/env.ts'
import { json } from '../_shared/http.ts'
import { safeEqual } from '../_shared/base64.ts'
import { ReauthError, accessTokenFor } from '../_shared/google.ts'
import { watchMailbox } from '../_shared/gmail.ts'
import { allAccounts, pruneEvents, updateAccount } from '../_shared/store.ts'
import { syncAccount } from '../_shared/sync.ts'

Deno.serve(async (req) => {
  const secret = req.headers.get('x-cron-secret') ?? ''
  if (!safeEqual(secret, env('MAIL_CRON_SECRET'))) return new Response('forbidden', { status: 403 })

  const topic = optionalEnv('MAIL_PUBSUB_TOPIC')
  const results: { email: string; ok: boolean; sync?: string; error?: string }[] = []
  for (const account of await allAccounts()) {
    if (account.status !== 'active') {
      results.push({ email: account.email, ok: false, error: 'needs_reauth' })
      continue
    }
    try {
      if (topic) {
        const token = await accessTokenFor(account)
        const watch = await watchMailbox(token, topic)
        await updateAccount(account.id, { watch_expires_at: new Date(Number(watch.expiration)).toISOString() })
      }
      const sync = await syncAccount(account)
      results.push({ email: account.email, ok: true, sync })
    } catch (err) {
      results.push({ email: account.email, ok: false, error: err instanceof ReauthError ? 'needs_reauth' : String((err as Error)?.message ?? err) })
    }
  }
  await pruneEvents()
  return json({ ranAt: new Date().toISOString(), accounts: results })
})
