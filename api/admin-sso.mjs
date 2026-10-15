// api/admin-sso.mjs: lets a signed-in admin open a separately hosted admin app without a second login.
//
//   GET ?app=pricing-desk   (Supabase session whose email is in ADMIN_EMAILS)
//     → { url } pointing at the app's /sso page with a signed ticket in the hash.
//
// The ticket is "<expires>.<HMAC-SHA256 of '<app>:<expires>'>" (base64url) and lives 60 seconds.
// The app checks it with the same SSO_SECRET and starts its own session. The Supabase token never
// leaves this site.
//
// Env vars (server only):
//   ADMIN_EMAILS     same as api/marketing.mjs
//   SSO_SECRET       shared with each app below (Vercel env var of the same name there)

import { createHmac } from 'node:crypto';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
const SSO_SECRET = process.env.SSO_SECRET || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
const TICKET_MS = 60_000;

const APPS = {
  'pricing-desk': 'https://pricing-desk.vercel.app',
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });

export function ticketFor(app, secret, now = Date.now()) {
  const expires = now + TICKET_MS;
  return `${expires}.${createHmac('sha256', secret).update(`${app}:${expires}`).digest('base64url')}`;
}

export default {
  async fetch(request) {
    const app = new URL(request.url).searchParams.get('app');
    if (request.method !== 'GET') return json({ error: 'Method not allowed.' }, 405);
    if (!APPS[app]) return json({ error: 'Unknown app.' }, 400);
    if (!SSO_SECRET || !SUPABASE_URL) return json({ error: 'Single sign-on is not configured.' }, 503);

    const token = /^Bearer\s+(.+)$/i.exec(request.headers.get('authorization') || '')?.[1];
    if (!token) return json({ error: 'Sign in first.' }, 401);
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return json({ error: 'Your session expired. Sign in again.' }, 401);
    const user = await res.json();
    if (!user?.email || !ADMIN_EMAILS.includes(user.email.toLowerCase())) {
      return json({ error: 'This account is not allowed to open admin apps.' }, 403);
    }
    return json({ url: `${APPS[app]}/sso#${ticketFor(app, SSO_SECRET)}` });
  },
};
