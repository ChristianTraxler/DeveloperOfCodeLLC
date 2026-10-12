// Responses, errors and CORS for the Mail functions.
import { ConfigError, list } from './env.ts'

export class HttpError extends Error {
  status: number
  code: string
  detail?: unknown
  constructor(status: number, code: string, message?: string, detail?: unknown) {
    super(message ?? code)
    this.status = status
    this.code = code
    this.detail = detail
  }
}

// Only the admin's own origins (MAIL_APP_ORIGINS) may call these functions from a browser.
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = list('MAIL_APP_ORIGINS')
  const allow = allowed.length === 0 ? '*' : allowed.includes(origin) ? origin : allowed[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  })
}

export function errorResponse(err: unknown, headers: Record<string, string> = {}): Response {
  if (err instanceof HttpError) {
    return json({ error: err.code, message: err.message, detail: err.detail ?? null }, err.status, headers)
  }
  if (err instanceof ConfigError) {
    return json({ error: 'config', message: `The ${err.setting} setting is missing. See the setup guide.` }, 500, headers)
  }
  const e = err as { status?: number; message?: string; reason?: string }
  if (e && typeof e.status === 'number' && e.status >= 400 && e.status < 600) {
    console.error('Gmail error', e.status, e.reason, e.message)
    const code = e.status === 429 ? 'rate_limited' : e.status === 404 ? 'not_found' : e.status === 403 ? 'forbidden' : 'gmail'
    return json({ error: code, message: e.message ?? 'Gmail returned an error.' }, e.status === 404 ? 404 : 502, headers)
  }
  console.error(err)
  return json({ error: 'server', message: 'Something went wrong on the server. Try again in a moment.' }, 500, headers)
}

export function html(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Runs fn over items with at most `limit` in flight, keeping the input order
export async function pool<T, R>(items: T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length)
  let next = 0
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++
      out[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return out
}
