// api/status.mjs — public status proxy for the footer badge
//
// The status page itself is hosted by Better Stack at status.developerofcode.com
// (a CNAME to statuspage.betteruptime.com). Better Stack exposes the page as JSON
// at <status page>/index.json, but their docs don't promise CORS headers, so the
// browser never talks to them directly — this endpoint fetches it server-side and
// hands the badge a single same-origin field.
//
// Response: { state, url }
//   state  one of: operational | degraded | downtime | maintenance | unknown
//   url    where the badge should link
//
// "unknown" is a normal answer, not an error: it covers the window before the
// custom domain's certificate is issued, and any Better Stack outage. The badge
// renders neutral for it — we never claim "operational" we couldn't verify.
//
// Env vars (optional):
//   STATUS_PAGE_URL   override the status page origin (no trailing slash)

const STATUS_PAGE_URL = (
  process.env.STATUS_PAGE_URL || 'https://status.developerofcode.com'
).replace(/\/+$/, '');

// The four states Better Stack's aggregate_state can report. Anything else we
// don't recognize is treated as unknown rather than passed through to the badge.
const KNOWN_STATES = ['operational', 'degraded', 'downtime', 'maintenance'];

const UPSTREAM_TIMEOUT_MS = 5000;

function json(body, { maxAge }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // Cached at the edge so a busy page doesn't hammer Better Stack. A failed
      // lookup gets a short TTL so the badge recovers soon after they do.
      'Cache-Control': `public, s-maxage=${maxAge}, stale-while-revalidate=300`,
    },
  });
}

export default {
  async fetch() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

    try {
      const res = await fetch(`${STATUS_PAGE_URL}/index.json`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) {
        return json({ state: 'unknown', url: STATUS_PAGE_URL }, { maxAge: 30 });
      }

      const body = await res.json();
      const state = body?.data?.attributes?.aggregate_state;

      if (!KNOWN_STATES.includes(state)) {
        return json({ state: 'unknown', url: STATUS_PAGE_URL }, { maxAge: 30 });
      }

      return json({ state, url: STATUS_PAGE_URL }, { maxAge: 60 });
    } catch {
      // Timeout, DNS failure, invalid JSON — all the same to the badge.
      return json({ state: 'unknown', url: STATUS_PAGE_URL }, { maxAge: 30 });
    } finally {
      clearTimeout(timer);
    }
  },
};
