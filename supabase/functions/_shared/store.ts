// Database access for the Mail functions. Uses the project's secret key, so it bypasses RLS:
// every function checks who is calling before it gets here.
import { createClient, type SupabaseClient, type User } from 'npm:@supabase/supabase-js@2.116.0'
import { env, list, serviceKey } from './env.ts'
import { HttpError } from './http.ts'
import { seal, unseal } from './crypto.ts'

export type Account = {
  id: string
  owner_id: string
  email: string
  aliases: string[]
  history_id: string | null
  watch_expires_at: string | null
  last_push_at: string | null
  last_sync_at: string | null
  status: 'active' | 'needs_reauth'
}

export type NewMail = { messageId: string; threadId: string }

let client: SupabaseClient | null = null
export function db(): SupabaseClient {
  if (!client) {
    client = createClient(env('SUPABASE_URL'), serviceKey(), {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
  }
  return client
}

function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Database: ${result.error.message}`)
  return result.data
}

// The admin login making this request. MAIL_ALLOWED_USERS (comma separated emails) can limit
// Mail to specific admin logins, which matters if the project allows public sign-ups.
export async function userFromRequest(req: Request): Promise<User> {
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!jwt) throw new HttpError(401, 'signed_out', 'Sign in to the admin first.')
  const { data, error } = await db().auth.getUser(jwt)
  if (error || !data?.user) throw new HttpError(401, 'signed_out', 'Your admin session ended. Sign in again.')
  const allowed = list('MAIL_ALLOWED_USERS').map((e) => e.toLowerCase())
  if (allowed.length && !allowed.includes((data.user.email ?? '').toLowerCase())) {
    throw new HttpError(403, 'not_allowed', 'This admin login is not allowed to use Mail.')
  }
  return data.user
}

export async function accountForOwner(ownerId: string): Promise<Account | null> {
  return check(await db().from('mail_accounts').select('*').eq('owner_id', ownerId).maybeSingle()) as Account | null
}

export async function accountByEmail(email: string): Promise<Account | null> {
  return check(await db().from('mail_accounts').select('*').eq('email', email.toLowerCase()).maybeSingle()) as Account | null
}

export async function accountById(id: string): Promise<Account | null> {
  return check(await db().from('mail_accounts').select('*').eq('id', id).maybeSingle()) as Account | null
}

export async function allAccounts(): Promise<Account[]> {
  return (check(await db().from('mail_accounts').select('*')) ?? []) as Account[]
}

export async function updateAccount(id: string, patch: Partial<Account>): Promise<void> {
  check(await db().from('mail_accounts').update(patch).eq('id', id))
}

export async function upsertAccount(row: Partial<Account> & { owner_id: string; email: string }): Promise<Account> {
  const saved = check(
    await db().from('mail_accounts').upsert(row, { onConflict: 'owner_id' }).select('*').single(),
  )
  return saved as Account
}

export async function deleteAccount(id: string): Promise<void> {
  check(await db().from('mail_accounts').delete().eq('id', id))
}

// ---------- Tokens ----------

type CredentialRow = {
  account_id: string
  refresh_token_enc: string
  access_token_enc: string | null
  access_expires_at: string | null
  scope: string | null
}

export async function readCredentials(accountId: string): Promise<{ refreshToken: string; accessToken: string | null; accessExpiresAt: number } | null> {
  const row = check(await db().from('mail_credentials').select('*').eq('account_id', accountId).maybeSingle()) as CredentialRow | null
  if (!row) return null
  return {
    refreshToken: await unseal(row.refresh_token_enc),
    accessToken: row.access_token_enc ? await unseal(row.access_token_enc) : null,
    accessExpiresAt: row.access_expires_at ? Date.parse(row.access_expires_at) : 0,
  }
}

export async function saveCredentials(
  accountId: string,
  values: { refreshToken?: string; accessToken?: string; expiresAt?: Date; scope?: string },
): Promise<void> {
  const row: Record<string, unknown> = { account_id: accountId }
  if (values.refreshToken) row.refresh_token_enc = await seal(values.refreshToken)
  if (values.accessToken) row.access_token_enc = await seal(values.accessToken)
  if (values.expiresAt) row.access_expires_at = values.expiresAt.toISOString()
  if (values.scope) row.scope = values.scope
  if (row.refresh_token_enc) {
    check(await db().from('mail_credentials').upsert(row, { onConflict: 'account_id' }))
  } else {
    check(await db().from('mail_credentials').update(row).eq('account_id', accountId))
  }
}

// ---------- Change feed ----------

export async function recordEvent(
  account: Account,
  event: { kind: 'changes' | 'resync'; threadIds: string[]; newMail: NewMail[]; historyId: string | null },
): Promise<void> {
  check(
    await db().from('mail_events').insert({
      account_id: account.id,
      owner_id: account.owner_id,
      kind: event.kind,
      thread_ids: event.threadIds.slice(0, 500),
      new_mail: event.newMail.slice(0, 100),
      history_id: event.historyId,
    }),
  )
}

export async function pruneEvents(days = 3): Promise<void> {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  check(await db().from('mail_events').delete().lt('created_at', cutoff))
  const stale = new Date(Date.now() - 86_400_000).toISOString()
  check(await db().from('mail_oauth_states').delete().lt('created_at', stale))
}
