// Google sign-in: the consent link, code exchange, token refresh and revoke.
import { env, optionalEnv } from './env.ts'
import { HttpError } from './http.ts'
import { type Account, readCredentials, saveCredentials, updateAccount } from './store.ts'

// Read, send, label, archive and trash. It can't permanently delete mail.
export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.modify'

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

export class OAuthError extends Error {
  code: string
  constructor(code: string, message?: string) {
    super(message ?? code)
    this.code = code
  }
}

export class ReauthError extends HttpError {
  constructor() {
    super(409, 'reauth', 'Google needs you to link Gmail again.')
  }
}

// Must match an "Authorized redirect URI" on the Google OAuth client exactly
export function redirectUri(): string {
  return optionalEnv('MAIL_OAUTH_REDIRECT_URI') ?? `${env('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/mail-auth`
}

export function consentUrl(state: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: env('GOOGLE_CLIENT_ID'),
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: GMAIL_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  })
  if (loginHint) params.set('login_hint', loginHint)
  return `${AUTH_URL}?${params}`
}

type TokenResponse = {
  access_token: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  token_type?: string
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env('GOOGLE_CLIENT_ID'),
      client_secret: env('GOOGLE_CLIENT_SECRET'),
      ...body,
    }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new OAuthError(String(data.error ?? 'oauth'), String(data.error_description ?? res.statusText))
  return data as TokenResponse
}

export const exchangeCode = (code: string) =>
  tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: redirectUri() })

export const refreshAccess = (refreshToken: string) =>
  tokenRequest({ refresh_token: refreshToken, grant_type: 'refresh_token' })

export async function revoke(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token }),
  }).catch(() => undefined)
}

// A valid access token for the account, refreshed (and re-sealed) when it is close to expiring
export async function accessTokenFor(account: Account): Promise<string> {
  if (account.status === 'needs_reauth') throw new ReauthError()
  const creds = await readCredentials(account.id)
  if (!creds) throw new ReauthError()
  if (creds.accessToken && creds.accessExpiresAt - Date.now() > 90_000) return creds.accessToken
  let fresh: TokenResponse
  try {
    fresh = await refreshAccess(creds.refreshToken)
  } catch (err) {
    if (err instanceof OAuthError && (err.code === 'invalid_grant' || err.code === 'unauthorized_client')) {
      await updateAccount(account.id, { status: 'needs_reauth' })
      throw new ReauthError()
    }
    throw err
  }
  await saveCredentials(account.id, {
    accessToken: fresh.access_token,
    expiresAt: new Date(Date.now() + (fresh.expires_in ?? 3600) * 1000),
  })
  return fresh.access_token
}
