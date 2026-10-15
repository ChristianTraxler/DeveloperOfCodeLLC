// api/_lib/seo-gbp.mjs: the Google Business Profile entered by hand, for when Google Places
// (which needs a Google billing account) is not set up.
//
//   parseMapsLink(url)          checks a Google Maps or profile share link and reads the business
//                               name from it when the link carries one
//   resolveMapsLink(url, deps)  follows short share links (maps.app.goo.gl, share.google, g.page)
//                               to the full Google address, without reading any page
//   manualPlace(body, link)     the typed-in profile, in the same shape Google Places gives, so the
//                               gbp, reviews and nap checks run on it unchanged
//
// Nothing here scrapes Google. The only request is the redirect of a short link.

import { safeFetch } from './seo-checks.mjs';

export class GbpInputError extends Error {}

const GOOGLE = /^(?:www\.|maps\.)?google\.(?:com|[a-z]{2,3}|com?\.[a-z]{2})$/i;
const SHORT = /^(?:maps\.app\.goo\.gl|goo\.gl|g\.page|share\.google)$/i;

const text = (v, max) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const words = (s) => text(decodeURIComponent(String(s).replace(/\+/g, ' ')), 120);

export function parseMapsLink(raw) {
  const input = text(raw, 2000);
  if (!input) return null;
  let u;
  try {
    u = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    throw new GbpInputError('That does not look like a Google Maps link.');
  }
  const host = u.hostname.toLowerCase();
  const short = SHORT.test(host);
  if (!short && !(GOOGLE.test(host) && (/^\/maps\b/.test(u.pathname) || u.pathname === '/search' || host.startsWith('maps.')))) {
    throw new GbpInputError('Paste the link from Google Maps or the "Share" button on the Google profile.');
  }
  if (short && host === 'goo.gl' && !u.pathname.startsWith('/maps')) throw new GbpInputError('That short link is not a Google Maps link.');
  u.protocol = 'https:';
  u.hash = '';
  let name = null;
  try {
    name = (/\/maps\/place\/([^/@]+)/.exec(u.pathname)?.[1] && words(/\/maps\/place\/([^/@]+)/.exec(u.pathname)[1])) || (u.searchParams.get('q') && words(u.searchParams.get('q'))) || null;
  } catch {
    name = null;
  }
  return { url: u.href, short, name };
}

// Short share links answer with a redirect to the full Google address. Each hop must stay on
// Google, and no page body is read.
export async function resolveMapsLink(raw, { fetch: fetchImpl = globalThis.fetch, hops = 4 } = {}) {
  let link = parseMapsLink(raw);
  for (let i = 0; link?.short && i < hops; i++) {
    let next;
    try {
      const r = await safeFetch(fetchImpl, link.url, { redirect: 'manual', read: false, timeoutMs: 6000 });
      next = r.location;
    } catch {
      return { ...link, resolved: false };
    }
    if (!next) return { ...link, resolved: false };
    try {
      link = parseMapsLink(next);
    } catch {
      return { ...link, resolved: false }; // it left Google, so keep the short link
    }
  }
  return { ...link, resolved: !link?.short };
}

const num = (v, { min, max, int = false }) => {
  if (v === '' || v == null) return null;
  const n = Number(String(v).replace(/,/g, ''));
  if (!Number.isFinite(n) || n < min || n > max || (int && !Number.isInteger(n))) return NaN;
  return n;
};

// The street number, street and ZIP from a typed address, for the name, address and phone match.
export function addressParts(address) {
  const a = text(address, 200);
  const street = /^(\d{1,6}[A-Za-z]?)\s+([^,]+)/.exec(a);
  const zips = [...a.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)];
  return { streetNumber: street?.[1] || null, route: street ? text(street[2], 80) : null, postalCode: zips.length ? zips.at(-1)[1] : null };
}

// body: { name, address, phone, website, category, rating, reviews, photos, hoursListed, hours, status }
export function manualPlace(body, link) {
  const name = text(body.name, 120) || link?.name || '';
  if (!name) throw new GbpInputError('Enter the business name as it shows on Google.');
  const rating = num(body.rating, { min: 1, max: 5 });
  if (Number.isNaN(rating)) throw new GbpInputError('The rating is a number from 1.0 to 5.0. Leave it empty if there are no reviews.');
  const reviews = num(body.reviews, { min: 0, max: 1_000_000, int: true });
  if (Number.isNaN(reviews)) throw new GbpInputError('Enter the number of reviews as a whole number.');
  const photos = num(body.photos, { min: 0, max: 100_000, int: true });
  if (Number.isNaN(photos)) throw new GbpInputError('Enter the number of photos as a whole number (a rough count is fine).');
  let website = text(body.website, 300) || null;
  if (website) {
    try {
      website = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`).href;
    } catch {
      throw new GbpInputError('The website on the profile does not look like an address.');
    }
  }
  const hours = String(body.hours ?? '')
    .split(/\r?\n/)
    .map((l) => text(l, 80))
    .filter(Boolean)
    .slice(0, 7);
  const address = text(body.address, 200) || null;
  const status = ['CLOSED_TEMPORARILY', 'CLOSED_PERMANENTLY'].includes(body.status) ? body.status : 'OPERATIONAL';
  return {
    placeId: null,
    manual: true,
    name,
    address,
    ...addressParts(address || ''),
    phone: text(body.phone, 40) || null,
    website,
    rating: reviews === 0 ? null : rating,
    reviews: reviews ?? 0,
    hours,
    hoursListed: hours.length > 0 || !!body.hoursListed,
    photos: photos ?? 0,
    category: text(body.category, 80) || null,
    status,
    mapsUrl: link?.url || null,
  };
}
