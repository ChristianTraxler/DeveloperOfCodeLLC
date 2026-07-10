// api/keep-alive.mjs — Supabase keep-alive ping
//
// Supabase pauses free-tier projects after 7 days of no activity. This endpoint
// makes one lightweight read against the database so the project stays awake.
// It is triggered daily by a Vercel Cron Job (see the "crons" block in vercel.json),
// which keeps us comfortably inside the 7-day window even if a run is skipped.
//
// No npm dependencies — uses the global fetch against the Supabase REST API,
// matching the style of api/notify.mjs.
//
// Env vars (Vercel → Project → Settings → Environment Variables):
//   SUPABASE_URL / VITE_SUPABASE_URL            (falls back to the public project URL)
//   SUPABASE_ANON_KEY / VITE_SUPABASE_ANON_KEY  (the anon key is public by design)
//   CRON_SECRET   optional — if set, Vercel sends it as a Bearer token on cron
//                 invocations and we reject requests that don't match it.

// The anon key is PUBLIC by design (it already ships in admin/supabase.js); these
// fallbacks just let the keep-alive work out-of-the-box without extra env config.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://puidodfmebwqzbbtqjiu.supabase.co';

const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1aWRvZGZtZWJ3cXpiYnRxaml1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk2Mjc5NDEsImV4cCI6MjA5NTIwMzk0MX0.5kl_QQ2r1zAOfQ1bjBAJ-HpfQbRYRTl7o40NljnDE_c';

// A tiny read against a real table is what actually counts as database activity.
const KEEP_ALIVE_TABLE = 'projects';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export default {
  async fetch(request) {
    // If CRON_SECRET is configured, only allow Vercel Cron (or a caller that knows it).
    const secret = process.env.CRON_SECRET;
    if (secret) {
      const auth = request.headers.get('authorization');
      if (auth !== `Bearer ${secret}`) {
        return json({ ok: false, message: 'Unauthorized.' }, 401);
      }
    }

    const url = `${SUPABASE_URL}/rest/v1/${KEEP_ALIVE_TABLE}?select=id&limit=1`;

    try {
      const res = await fetch(url, {
        method: 'HEAD', // cheapest possible request; still touches Postgres via PostgREST
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      // Any HTTP response (even a 4xx from Row Level Security) means the database
      // was reached, which is all we need to reset the inactivity timer.
      return json({
        ok: true,
        pingedAt: new Date().toISOString(),
        supabaseStatus: res.status,
        table: KEEP_ALIVE_TABLE,
      });
    } catch (err) {
      console.error('Supabase keep-alive failed:', err);
      return json(
        { ok: false, message: 'Could not reach Supabase.', error: String(err) },
        502
      );
    }
  },
};
