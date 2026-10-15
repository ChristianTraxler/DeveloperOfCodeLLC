// Run with: node --test tests/admin-sso.test.mjs
// api/admin-sso.mjs with a stand-in for Supabase's /auth/v1/user.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';

process.env.SUPABASE_URL = 'https://sb.test';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.ADMIN_EMAILS = 'owner@example.test';
process.env.SSO_SECRET = 'shh';

const users = { good: 'Owner@Example.test', other: 'someone@example.test' };
globalThis.fetch = async (url, { headers }) => {
  assert.equal(url, 'https://sb.test/auth/v1/user');
  const email = users[headers.Authorization.replace('Bearer ', '')];
  return email ? new Response(JSON.stringify({ email })) : new Response('{}', { status: 401 });
};

const { default: api } = await import('../api/admin-sso.mjs');
const call = (token, app = 'pricing-desk') =>
  api.fetch(new Request(`https://site.test/api/admin-sso?app=${app}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  }));

test('an admin gets a signed 20 second ticket for the app', async () => {
  const before = Date.now();
  const res = await call('good');
  assert.equal(res.status, 200);
  const { url } = await res.json();
  const m = /^https:\/\/pricing-desk\.vercel\.app\/sso#(\d+)\.([\w-]+)$/.exec(url);
  assert.ok(m, url);
  const expires = Number(m[1]);
  assert.ok(expires >= before + 20_000 && expires <= Date.now() + 20_000);
  assert.equal(m[2], createHmac('sha256', 'shh').update(`pricing-desk:${expires}`).digest('base64url'));
});

test('no session, an expired session, a non-admin or an unknown app gets no ticket', async () => {
  assert.equal((await call()).status, 401);
  assert.equal((await call('stale')).status, 401);
  assert.equal((await call('other')).status, 403);
  assert.equal((await call('good', 'elsewhere')).status, 400);
});
