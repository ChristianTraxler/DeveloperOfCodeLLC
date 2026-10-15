// api/_lib/seo-local.mjs: the Phase 3 local layer.
//
//   findLocal()          Google Places (New) Text Search: the business, its map position and the
//                        top competitors. At most LOCAL.maxCallsPerReview calls, cached by the caller.
//   localChecks()        gbp, reviews and nap results for the client, from the place and site facts.
//   placeStatuses()      the same gbp and reviews grades for a competitor.
//   rankCheck()          the manual rank entry as a check.
//   competitorsCheck()   the client next to its competitors on the same checks.
//
// Pure except findLocal, which only calls fetch and the cache it is given. Thresholds are in
// seo-config.mjs (THRESHOLDS.reviews, .rank, .competitors and LOCAL).

import { CHECKS, LOCAL, STATUS_POINTS, THRESHOLDS } from './seo-config.mjs';
import { mentions, norm } from './seo-html.mjs';
import { errText, phoneDigits, result, skipped } from './seo-checks.mjs';

const SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'addressComponents',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'rating',
  'userRatingCount',
  'regularOpeningHours.weekdayDescriptions',
  'photos',
  'primaryType',
  'primaryTypeDisplayName',
  'businessStatus',
  'googleMapsUri',
]
  .map((f) => `places.${f}`)
  .join(',');

// Only http(s) links from Google are kept, so nothing else can reach an href.
const httpUrl = (u) => (typeof u === 'string' && /^https?:\/\//i.test(u) ? u : null);

// The facts the checks and reports use. Never the raw Places response.
export function compactPlace(p) {
  const part = (type) => (p.addressComponents || []).find((c) => (c.types || []).includes(type))?.shortText || null;
  return {
    placeId: p.id,
    name: p.displayName?.text || '',
    address: p.formattedAddress || null,
    streetNumber: part('street_number'),
    route: part('route'),
    postalCode: part('postal_code'),
    phone: p.nationalPhoneNumber || p.internationalPhoneNumber || null,
    website: httpUrl(p.websiteUri),
    rating: typeof p.rating === 'number' ? p.rating : null,
    reviews: typeof p.userRatingCount === 'number' ? p.userRatingCount : 0,
    hours: p.regularOpeningHours?.weekdayDescriptions || [],
    photos: (p.photos || []).length,
    category: p.primaryTypeDisplayName?.text || null,
    status: p.businessStatus || null,
    mapsUrl: httpUrl(p.googleMapsUri),
  };
}

export const hostOf = (u) => {
  try {
    return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
};

const sameName = (a, b) => !!a && !!b && (mentions(a, b) || mentions(b, a));

async function textSearch(fetchImpl, key, textQuery, pageSize) {
  const res = await fetchImpl(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
    body: JSON.stringify({ textQuery, pageSize, languageCode: 'en', regionCode: 'US' }),
    signal: AbortSignal.timeout(LOCAL.timeoutMs),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error?.message ? `Google Places said: ${data.error.message.slice(0, 160)}` : `Google Places answered with error ${res.status}`);
  return (data.places || []).map(compactPlace);
}

// input: { business, city, service, siteUrl }
// deps:  { fetch, key, cache: { get(key) -> data | null, set(key, data) } }
// Returns { configured, query, place, position, competitors, candidates, calls, error }.
// position is the business's place in the "[service] in [city]" results (1-based), or null.
export async function findLocal(input, deps = {}) {
  const query = `${input.service} in ${input.city}`;
  const out = { configured: !!deps.key, query, place: null, position: null, competitors: [], candidates: [], calls: 0, error: null };
  if (!deps.key) return out;
  const fetchImpl = deps.fetch || globalThis.fetch;
  const cache = deps.cache || { get: async () => null, set: async () => {} };

  const search = async (q, size) => {
    const cacheKey = `search:${norm(q).trim()}:${size}`;
    const hit = await cache.get(cacheKey).catch(() => null);
    if (Array.isArray(hit)) return hit;
    if (out.calls >= LOCAL.maxCallsPerReview) return [];
    out.calls++;
    const places = await textSearch(fetchImpl, deps.key, q, size);
    await cache.set(cacheKey, places).catch(() => {});
    await Promise.all(places.map((p) => cache.set(`place:${p.placeId}`, p).catch(() => {})));
    return places;
  };
  const host = hostOf(input.siteUrl);
  const isClient = (p) => (host && hostOf(p.website || '') === host) || sameName(p.name, input.business);

  try {
    const results = await search(query, LOCAL.searchSize);
    const i = results.findIndex(isClient);
    if (i >= 0) {
      out.place = results[i];
      out.position = i + 1;
    } else {
      const direct = await search(`${input.business} ${input.city}`, 5);
      out.place = direct.find(isClient) || null;
      out.candidates = direct.filter((p) => !results.some((r) => r.placeId === p.placeId));
    }
    out.competitors = results
      .filter((p) => p.placeId !== out.place?.placeId && !(host && hostOf(p.website || '') === host))
      .slice(0, LOCAL.competitors)
      .map((p) => ({ ...p, position: results.indexOf(p) + 1 }));
    out.candidates = [...results.map((p, n) => ({ ...p, position: n + 1 })), ...out.candidates.map((p) => ({ ...p, position: null }))].slice(0, 12);
  } catch (e) {
    out.error = errText(e);
  }
  return out;
}

// ── Grades shared by the client and its competitors ─────────────────────────

const CLOSED = { CLOSED_TEMPORARILY: 'marked temporarily closed', CLOSED_PERMANENTLY: 'marked permanently closed' };

export function gbpFacts(place) {
  const has = { hours: place.hours.length > 0, photos: place.photos > 0, website: !!place.website, category: !!place.category };
  const missing = Object.keys(has).filter((k) => !has[k]);
  return { has, missing, closed: CLOSED[place.status] || null };
}

export function reviewsGrade(place) {
  const t = THRESHOLDS.reviews;
  const rating = place.rating ?? 0;
  if (place.reviews < t.failCount || rating < t.failRating) return 'fail';
  if (place.reviews < t.warnCount || rating < t.warnRating) return 'warn';
  return 'pass';
}

// gbp and reviews statuses for a competitor's place.
export function placeStatuses(place) {
  if (!place) return {};
  const g = gbpFacts(place);
  return { gbp: g.closed || g.missing.length ? 'fail' : 'pass', reviews: reviewsGrade(place) };
}

const MISSING_LABEL = { hours: 'business hours', photos: 'photos', website: 'a website link', category: 'a main category' };
const list = (items) => (items.length < 3 ? items.join(' and ') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

function checkGbp(local, input) {
  const p = local.place;
  if (!p) {
    return result(
      'gbp',
      'fail',
      'No Google Business Profile found.',
      `A search for ${input.business} in ${input.city} did not turn up a Google Business Profile. The profile is what puts a business on the map and in the box at the top of local searches, so without one most nearby customers never see it. If there is a profile under a different name, it should match the name on the website.`,
      { query: local.query, found: false },
    );
  }
  const g = gbpFacts(p);
  const details = { found: true, name: p.name, address: p.address, category: p.category, photos: p.photos, hours: p.hours, has: g.has, rating: p.rating, reviews: p.reviews, position: local.position, query: local.query, mapsUrl: p.mapsUrl };
  if (g.closed) return result('gbp', 'fail', `The profile is ${g.closed}.`, `Google shows this business as ${g.closed}. People who find it on the map will think they cannot hire you. If that is wrong, update it in Google Business Profile right away.`, details);
  if (g.missing.length) {
    return result(
      'gbp',
      'fail',
      `The profile is missing ${list(g.missing.map((k) => MISSING_LABEL[k]))}.`,
      `The Google Business Profile is there, but it has no ${list(g.missing.map((k) => MISSING_LABEL[k]))}. Complete profiles get more calls and clicks, and Google uses these details to decide which businesses to show for a search.`,
      details,
    );
  }
  return result('gbp', 'pass', `Complete profile listed as ${p.category}.`, 'The Google Business Profile has hours, photos, a website link and a main category, which is what Google needs to show it with confidence.', details);
}

function checkReviews(local, competitors) {
  const p = local.place;
  if (!p) return skipped('reviews', 'there is no Google Business Profile to read reviews from');
  const t = THRESHOLDS.reviews;
  const status = reviewsGrade(p);
  const theirs = competitors.filter((c) => c.reviews != null);
  const compAvg = avg(theirs.map((c) => c.reviews));
  const compRating = avg(theirs.filter((c) => c.rating != null).map((c) => c.rating));
  const rating = p.rating == null ? 'no rating' : `a ${p.rating.toFixed(1)} rating`;
  const versus = compAvg != null ? ` The top ${theirs.length} nearby competitors average ${Math.round(compAvg)} reviews${compRating != null ? ` and a ${compRating.toFixed(1)} rating` : ''}.` : '';
  const details = { rating: p.rating, reviews: p.reviews, competitorAverage: compAvg == null ? null : Math.round(compAvg), competitorRating: compRating == null ? null : Math.round(compRating * 10) / 10 };
  const summary = `${p.reviews} ${p.reviews === 1 ? 'review' : 'reviews'}, ${rating}.`;
  if (status === 'fail') return result('reviews', 'fail', summary, `People compare reviews before they call, and Google favors businesses with more of them. Fewer than ${t.failCount} reviews or a rating under ${t.failRating.toFixed(1)} loses many of those calls.${versus}`, details);
  if (status === 'warn') return result('reviews', 'warn', summary, `A good start. Getting past ${t.warnCount} reviews with a rating of ${t.warnRating.toFixed(1)} or better makes the business easier to choose next to others on the map.${versus}`, details);
  return result('reviews', 'pass', summary, `Enough reviews with a strong rating to stand out on the map.${versus}`, details);
}

// Name, address, phone and website on the site against the Google Business Profile.
export function compareNap(place, facts, siteUrl) {
  const items = [];
  if (!place || !facts) return items;
  const siteName = facts.schemaName || '';
  items.push({ key: 'name', label: 'Business name', google: place.name, site: siteName || null, ok: sameName(place.name, siteName) || mentions(facts.brandText, place.name) });
  if (place.phone) {
    const want = phoneDigits(place.phone);
    items.push({ key: 'phone', label: 'Phone', google: place.phone, site: facts.phones.length ? facts.phones.map((d) => `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`).slice(0, 3).join(', ') : null, ok: facts.phones.includes(want) });
  }
  if (place.streetNumber && place.route) {
    const routeWord = norm(place.route).trim().split(' ').find((w) => w.length > 2 && !/^(north|south|east|west)$/.test(w)) || norm(place.route).trim();
    const texts = [facts.schemaAddress || '', ...facts.streets];
    const ok = texts.some((t) => norm(t).includes(` ${place.streetNumber} `) && norm(t).includes(` ${routeWord.slice(0, 4)}`)) || (!!place.postalCode && facts.postalCodes.includes(place.postalCode) && texts.some((t) => norm(t).includes(` ${place.streetNumber} `)));
    items.push({ key: 'address', label: 'Address', google: place.address, site: facts.schemaAddress || facts.streets[0] || null, ok });
  }
  if (place.website) items.push({ key: 'website', label: 'Website on the profile', google: hostOf(place.website), site: hostOf(siteUrl), ok: hostOf(place.website) === hostOf(siteUrl) });
  return items;
}

function checkNap(local, facts, siteUrl) {
  if (!local.place) return skipped('nap', 'there is no Google Business Profile to compare with');
  if (!facts) return skipped('nap', 'the home page could not be read');
  const items = compareNap(local.place, facts, siteUrl);
  const off = items.filter((i) => !i.ok);
  const details = { items };
  if (!off.length) return result('nap', 'pass', 'The site matches the Google Business Profile.', 'The name, phone, address and website on the home page match Google. Matching details help Google trust that both are the same business.', details);
  const what = list(off.map((i) => i.label.toLowerCase()));
  const status = off.length === 1 ? 'warn' : 'fail';
  return result(
    'nap',
    status,
    `The ${what} ${off.length === 1 ? 'does' : 'do'} not match Google.`,
    `The ${what} on the home page ${off.length === 1 ? 'is' : 'are'} missing or different from the Google Business Profile. When the two disagree, Google is less sure they are the same business, and customers can end up calling an old number or driving to the wrong place.`,
    details,
  );
}

// The client's gbp, reviews and nap checks.
// local: findLocal() output; facts: siteFacts() from the home page; input: { business, city, siteUrl }.
export function localChecks(local, facts, input) {
  if (!local.configured) return ['gbp', 'reviews', 'nap'].map((k) => skipped(k, 'Google Places is not set up yet'));
  if (local.error) return ['gbp', 'reviews', 'nap'].map((k) => skipped(k, local.error));
  return [checkGbp(local, input), checkReviews(local, local.competitors), checkNap(local, facts, input.siteUrl)];
}

// rank: position from a Google search for the keyword, or null when it is not in the top 10.
export function rankCheck(keyword, position) {
  const t = THRESHOLDS.rank;
  const details = { keyword, position: position ?? null };
  if (position == null || position > t.warn) {
    return result('rank', 'fail', `Not in the top ${t.warn} for "${keyword}".`, `When someone searches "${keyword}", this business does not show up on the first page. Most people call one of the first few results, so those calls go to competitors.`, details);
  }
  if (position > t.pass) return result('rank', 'warn', `Number ${position} for "${keyword}".`, `The business shows on the first page for "${keyword}", but below the top ${t.pass}. Most clicks go to the first few results, so moving up is worth real calls.`, details);
  return result('rank', 'pass', `Number ${position} for "${keyword}".`, `The business is in the top ${t.pass} when people search "${keyword}", where most of the calls come from.`, details);
}

const points = (status) => STATUS_POINTS[status] ?? null;
// Checks that are compared head to head. rank and competitors are about the client alone.
const COMPARED = Object.keys(CHECKS).filter((k) => k !== 'rank' && k !== 'competitors');

// client: { [key]: status }; competitors: [{ name, statuses: { [key]: status } }], finished ones only.
export function compareChecks(client, competitors) {
  const rows = [];
  for (const key of COMPARED) {
    const mine = points(client[key]);
    if (mine == null) continue;
    const theirs = competitors.map((c) => points(c.statuses?.[key])).filter((p) => p != null);
    if (!theirs.length) continue;
    const ahead = theirs.filter((p) => p > mine).length;
    const behindOf = theirs.filter((p) => p < mine).length;
    rows.push({ key, behind: ahead > theirs.length / 2, ahead: behindOf > theirs.length / 2 });
  }
  return rows;
}

export function competitorsCheck(client, competitors) {
  const t = THRESHOLDS.competitors;
  const done = competitors.filter((c) => c.statuses && Object.keys(c.statuses).length);
  if (!done.length) return skipped('competitors', 'no competitor could be checked');
  const rows = compareChecks(client, done);
  if (rows.length < t.minCompared) return skipped('competitors', 'too few checks could be compared');
  const behind = rows.filter((r) => r.behind).map((r) => r.key);
  const ahead = rows.filter((r) => r.ahead).map((r) => r.key);
  const share = behind.length / rows.length;
  const status = share > t.failShareBehind ? 'fail' : share >= t.warnShareBehind ? 'warn' : 'pass';
  const names = list(done.map((c) => c.name));
  const label = (k) => CHECKS[k].label.toLowerCase();
  const details = { compared: rows.length, behind, ahead, competitors: done.map((c) => c.name) };
  const summary = `Behind on ${behind.length} of ${rows.length} checks, ahead on ${ahead.length}.`;
  if (status === 'fail') return result('competitors', 'fail', summary, `On the same checks, ${names} ${done.length === 1 ? 'comes' : 'come'} out ahead on most of them, including ${list(behind.slice(0, 3).map(label))}. Google compares nearby businesses when it picks who to show, so closing these gaps improves your chances.`, details);
  if (status === 'warn') return result('competitors', 'warn', summary, `The business holds its own against ${names}, but trails on ${list(behind.slice(0, 3).map(label))}. Those are the gaps to close first.`, details);
  return result('competitors', 'pass', summary, `On the same checks, the business is level with or ahead of ${names} on most of them.`, details);
}
