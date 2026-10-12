// mail-auth: links and unlinks Gmail.
//
//   POST { action: "start", redirectTo }  (admin login required)
//     Returns { url } for Google's consent screen. redirectTo is where the admin lands afterward
//     and must be on one of MAIL_APP_ORIGINS.
//   GET  ?code&state  (Google redirects here)
//     Exchanges the code, stores the encrypted tokens, starts the Gmail watch, then sends the
//     browser back to redirectTo with "mail=linked" or "mail=error&reason=..." in the hash.
//   POST { action: "disconnect" }  (admin login required)
//     Stops the watch, revokes Google's access and deletes the stored account and tokens.
import { list, optionalEnv } from '../_shared/env.ts'
import { HttpError, corsHeaders, errorResponse, html, json } from '../_shared/http.ts'
import { randomToken } from '../_shared/base64.ts'
import { GMAIL_SCOPE, ReauthError, accessTokenFor, consentUrl, exchangeCode, revoke } from '../_shared/google.ts'
import { profile, sendAsList, stopWatch, watchMailbox } from '../_shared/gmail.ts'
import {
  accountForOwner,
  db,
  deleteAccount,
  readCredentials,
  saveCredentials,
  updateAccount,
  upsertAccount,
  userFromRequest,
} from '../_shared/store.ts'

const STATE_MINUTES = 15

function checkReturnUrl(value: unknown): string {
  const origins = list('MAIL_APP_ORIGINS')
  if (!origins.length) throw new HttpError(500, 'config', 'The MAIL_APP_ORIGINS setting is missing. See the setup guide.')
  let url: URL
  try {
    url = new URL(String(value ?? ''))
  } catch {
    throw new HttpError(400, 'bad_request', 'The return address is not a valid URL.')
  }
  if (!origins.includes(url.origin)) throw new HttpError(400, 'bad_origin', `${url.origin} is not in MAIL_APP_ORIGINS.`)
  return url.toString()
}

// Adds the result to the hash, so it works with hash routes (#/mail) and plain paths alike
function withResult(target: string, result: string): string {
  const at = target.indexOf('#')
  if (at === -1) return `${target}#mail=${result}`
  const hash = target.slice(at)
  return `${target}${hash.includes('?') ? '&' : '?'}mail=${result}`
}

const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to, 'Cache-Control': 'no-store' } })

function page(message: string, status = 400) {
  return html(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Mail</title>` +
      `<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#070a12;color:#ece8df;font:16px/1.6 system-ui,sans-serif;padding:24px">` +
      `<p style="max-width:42ch;text-align:center">${message}</p></body>`,
    status,
  )
}

async function start(userId: string, email: string | undefined, body: Record<string, unknown>) {
  const redirectTo = checkReturnUrl(body.redirectTo)
  const state = randomToken(24)
  const { error } = await db().from('mail_oauth_states').insert({ state, owner_id: userId, redirect_to: redirectTo })
  if (error) throw new Error(`Database: ${error.message}`)
  const hint = typeof body.loginHint === 'string' && body.loginHint ? body.loginHint : undefined
  return { url: consentUrl(state, hint ?? (email && /@gmail\.com$/i.test(email) ? email : undefined)) }
}

async function callback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const state = url.searchParams.get('state') ?? ''
  if (!state) return page('This page is only used while linking Gmail. Go back to the admin and choose Link Gmail.')
  const { data: row } = await db().from('mail_oauth_states').select('*').eq('state', state).maybeSingle()
  if (!row) return page('This sign-in link has already been used or has expired. Go back to the admin and choose Link Gmail again.')
  await db().from('mail_oauth_states').delete().eq('state', state)

  const back = (result: string) => redirect(withResult(row.redirect_to as string, result))
  if (Date.now() - Date.parse(row.created_at as string) > STATE_MINUTES * 60_000) return back('error&reason=expired')
  const googleError = url.searchParams.get('error')
  if (googleError) return back(`error&reason=${googleError === 'access_denied' ? 'denied' : 'google'}`)
  const code = url.searchParams.get('code')
  if (!code) return back('error&reason=google')

  try {
    const tokens = await exchangeCode(code)
    const scopes = String(tokens.scope ?? '').split(/\s+/)
    if (!scopes.includes(GMAIL_SCOPE) && !scopes.includes('https://mail.google.com/')) return back('error&reason=scope')
    if (!tokens.refresh_token) return back('error&reason=refresh')

    const me = await profile(tokens.access_token)
    const email = me.emailAddress.toLowerCase()
    const ownerId = row.owner_id as string

    const { data: other } = await db().from('mail_accounts').select('id, owner_id').eq('email', email).maybeSingle()
    if (other && other.owner_id !== ownerId) return back('error&reason=taken')

    // Linking a different Gmail address replaces the old one
    const existing = await accountForOwner(ownerId)
    if (existing && existing.email !== email) {
      await cleanUp(existing.id).catch(() => undefined)
      await deleteAccount(existing.id)
    }

    const aliases = await sendAsList(tokens.access_token)
      .then((list) => list.map((s) => s.sendAsEmail.toLowerCase()))
      .catch(() => [] as string[])

    const keepHistory = existing && existing.email === email && existing.history_id
    const account = await upsertAccount({
      owner_id: ownerId,
      email,
      aliases: [...new Set([email, ...aliases])],
      status: 'active',
      ...(keepHistory ? {} : { history_id: me.historyId }),
    })
    await saveCredentials(account.id, {
      refreshToken: tokens.refresh_token,
      accessToken: tokens.access_token,
      expiresAt: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000),
      scope: tokens.scope,
    })

    const topic = optionalEnv('MAIL_PUBSUB_TOPIC')
    if (topic) {
      try {
        const watch = await watchMailbox(tokens.access_token, topic)
        await updateAccount(account.id, { watch_expires_at: new Date(Number(watch.expiration)).toISOString() })
      } catch (err) {
        console.error('Gmail watch failed', err)
        return back('linked&push=failed')
      }
    }
    return back('linked')
  } catch (err) {
    console.error('Linking Gmail failed', err)
    return back('error&reason=server')
  }
}

// Stops the watch and revokes Google's access for an account
async function cleanUp(accountId: string) {
  const creds = await readCredentials(accountId)
  if (!creds) return
  try {
    const { data: account } = await db().from('mail_accounts').select('*').eq('id', accountId).single()
    const token = await accessTokenFor(account)
    await stopWatch(token).catch(() => undefined)
  } catch (err) {
    if (!(err instanceof ReauthError)) console.error('Stopping the watch failed', err)
  }
  await revoke(creds.refreshToken)
}

async function disconnect(userId: string) {
  const account = await accountForOwner(userId)
  if (!account) return { linked: false }
  await cleanUp(account.id).catch((err) => console.error('Unlink clean-up failed', err))
  await deleteAccount(account.id)
  return { linked: false }
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method === 'GET') {
    try {
      return await callback(req)
    } catch (err) {
      console.error(err)
      return page('Something went wrong while linking Gmail. Go back to the admin and try again.', 500)
    }
  }
  try {
    const user = await userFromRequest(req)
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    if (body.action === 'start') return json(await start(user.id, user.email, body), 200, cors)
    if (body.action === 'disconnect') return json(await disconnect(user.id), 200, cors)
    throw new HttpError(400, 'bad_request', 'Unknown action.')
  } catch (err) {
    return errorResponse(err, cors)
  }
})
