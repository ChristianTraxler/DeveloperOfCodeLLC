// Fakes for tests/seo-api.test.mjs (and local screenshots): an in-memory stand-in for the
// parts of Supabase's REST API that api/seo.mjs uses, plus made-up Google Places answers and sites.
// installFakes() replaces globalThis.fetch. Set the env vars before importing api/seo.mjs.
import { randomUUID } from 'node:crypto';

export function installFakes() {
  // ── In-memory PostgREST: just the filters api/seo.mjs uses ──────────────────

  const db = { seo_audits: [], seo_audit_checks: [], seo_audit_tasks: [], seo_audit_competitors: [], seo_audit_manual: [], seo_places_cache: [] };
  let serial = 1;
  const DEFAULTS = {
    seo_audits: () => ({ id: randomUUID(), created_at: new Date().toISOString(), notes: {}, category_scores: {}, overall_score: null, reviewed_at: null, final_url: null, error: null, lead_id: null, duration_ms: null }),
    seo_audit_tasks: () => ({ done: false }),
    seo_audit_competitors: () => ({ status: 'pending', scores: {}, position: null, error: null, place_id: null, site_url: null }),
    seo_audit_checks: () => ({ details: {} }),
  };

  function matches(row, params) {
    for (const [col, cond] of params) {
      if (['select', 'order', 'limit', 'on_conflict'].includes(col)) continue;
      const v = row[col];
      const [op, ...rest] = cond.split('.');
      const arg = rest.join('.');
      if (op === 'eq' && String(v) !== arg) return false;
      if (op === 'neq' && String(v) === arg) return false;
      if (op === 'gte' && !(String(v) >= arg)) return false;
      if (op === 'in' && !arg.slice(1, -1).split(',').includes(String(v))) return false;
      if (op === 'not' && arg === 'is.null' && v == null) return false;
      if (op === 'is' && arg === 'null' && v != null) return false;
    }
    return true;
  }

  function supabase(url, init = {}) {
    const u = new URL(url);
    if (u.pathname === '/auth/v1/user') return Response.json({ email: 'owner@example.test' });
    const table = u.pathname.replace('/rest/v1/', '');
    const params = [...u.searchParams.entries()];
    const method = init.method || 'GET';
    const list = db[table];
    if (!list) return new Response('relation does not exist', { status: 404 });
    if (method === 'GET') {
      let out = list.filter((r) => matches(r, params));
      const limit = u.searchParams.get('limit');
      if (limit) out = out.slice(0, Number(limit));
      return Response.json(structuredClone(out));
    }
    if (method === 'DELETE') {
      db[table] = list.filter((r) => !matches(r, params));
      return new Response(null, { status: 204 });
    }
    const body = JSON.parse(init.body);
    if (method === 'PATCH') {
      for (const r of list.filter((r) => matches(r, params))) Object.assign(r, structuredClone(body));
      return new Response(null, { status: 204 });
    }
    const conflict = u.searchParams.get('on_conflict')?.split(',');
    const saved = [];
    for (const item of Array.isArray(body) ? body : [body]) {
      const existing = conflict && list.find((r) => conflict.every((c) => r[c] === item[c]));
      if (existing) {
        Object.assign(existing, structuredClone(item));
        saved.push(existing);
      } else {
        const row = { id: serial++, ...(DEFAULTS[table]?.() || {}), ...structuredClone(item) };
        list.push(row);
        saved.push(row);
      }
    }
    return Response.json(structuredClone(saved), { status: 201 });
  }

  // ── Made-up Google Places and sites ─────────────────────────────────────────

  const place = (id, name, website, reviews, rating = 4.7, extra = {}) => ({
    id,
    displayName: { text: name },
    formattedAddress: '1 Main St, Hickory, NC 28601, USA',
    addressComponents: [{ shortText: '1', types: ['street_number'] }, { shortText: 'Main St', types: ['route'] }, { shortText: '28601', types: ['postal_code'] }],
    nationalPhoneNumber: '(828) 555-0100',
    websiteUri: website,
    rating,
    userRatingCount: reviews,
    regularOpeningHours: { weekdayDescriptions: ['Monday: 8 AM to 5 PM'] },
    photos: [{}],
    primaryTypeDisplayName: { text: 'Pressure washing service' },
    businessStatus: 'OPERATIONAL',
    ...extra,
  });
  const PLACES = [
    place('pA', 'Shine Bros', 'https://shine.test/', 140, 4.9),
    place('pClient', 'Blue Ridge Wash', 'https://blueridge.test/', 18, 4.6),
    place('pB', 'Hickory Clean', 'https://hc.test/', 60),
    place('pC', 'Wash Pros', undefined, 4, 3.8),
  ];
  const stats = { placesCalls: 0 };

  const page = (title, h1, body) =>
    `<!doctype html><html><head><title>${title}</title><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${body.slice(0, 120)} pressure washing in Hickory NC for homes and businesses, free quotes."></head><body><h1>${h1}</h1><p>${body} ${'Real local work. '.repeat(25)}</p><a href="/services">Services</a><a href="/about">About</a><a href="/contact">Contact</a><a href="tel:8285550100">Call</a></body></html>`;
  const SITES = {
    'https://blueridge.test/': page('Home', 'Welcome', 'Blue Ridge Wash cleans houses. Call (828) 555-0100. 1 Main St, Hickory, NC 28601.'),
    'https://shine.test/': page('Pressure Washing in Hickory, NC | Shine Bros', 'Pressure washing in Hickory', 'Shine Bros pressure washing in Hickory NC.'),
    'https://hc.test/': page('Pressure Washing Hickory NC | Hickory Clean', 'Pressure washing in Hickory', 'Hickory Clean pressure washing in Hickory.'),
  };

  globalThis.fetch = async (url, init = {}) => {
    const s = String(url);
    if (s.startsWith('https://sb.test')) return supabase(s, init);
    if (s.startsWith('https://places.googleapis.com')) {
      stats.placesCalls++;
      const q = JSON.parse(init.body).textQuery;
      return Response.json({ places: q === 'Pressure washing in Hickory, NC' ? PLACES : [] });
    }
    if (s.startsWith('https://www.googleapis.com/pagespeedonline')) return new Response('{"error":{"message":"no key"}}', { status: 400 });
    if (SITES[s]) return new Response(init.method === 'HEAD' ? null : SITES[s], { status: 200, headers: { 'content-type': 'text/html' } });
    if (/robots\.txt$/.test(s)) return new Response('User-agent: *\nAllow: /', { status: 200, headers: { 'content-type': 'text/plain' } });
    return new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } });
  };
  return { db, stats };
}
