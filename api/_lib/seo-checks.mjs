// api/_lib/seo-checks.mjs: runs the Phase 1 checks for one site and returns plain results.
//
// runAudit() never throws for a single check. A check that cannot finish (timeout, blocked,
// API error) comes back as "skipped" with the reason, and the rest of the audit carries on.
// Nothing here touches Supabase; api/seo.mjs saves what this returns.

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { CHECKS, FETCH, STATUS_POINTS, THRESHOLDS, SERVICES } from './seo-config.mjs';
import { cityName, mentions, readPage, squash } from './seo-html.mjs';

export class AuditInputError extends Error {}

// ── URLs and safe fetching ──────────────────────────────────────────────────

export function normalizeUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new AuditInputError('Enter the website address.');
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new AuditInputError('That website address does not look right. Try something like example.com.');
  }
  if (!/^https?:$/.test(url.protocol)) throw new AuditInputError('Use a normal website address that starts with http or https.');
  if (!url.hostname.includes('.')) throw new AuditInputError('That website address needs a domain, like example.com.');
  url.hash = '';
  return url;
}

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^22[4-9]\./, /^2[3-5]\d\./];
// IPv6: loopback, unspecified, unique local, link local, multicast, documentation, and any
// address that wraps an IPv4 one (mapped ::ffff:, NAT64 64:ff9b::, 6to4 2002:) is judged by that IPv4.
function embeddedV4(ip) {
  const dotted = /(?:^::ffff:|^64:ff9b::|^::)(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1];
  if (dotted) return dotted;
  const hex = /^(?:::ffff:|64:ff9b::|2002:)([0-9a-f]{1,4}):([0-9a-f]{1,4})(?::|$)/i.exec(ip);
  if (!hex) return null;
  const [a, b] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
  return `${a >> 8}.${a & 255}.${b >> 8}.${b & 255}`;
}
const isPrivate = (ip) => {
  if (isIP(ip) === 4) return PRIVATE_V4.some((re) => re.test(ip));
  const v4 = embeddedV4(ip);
  if (v4) return PRIVATE_V4.some((re) => re.test(v4));
  return /^(::1?$|f[c-f]|ff|2001:db8:|::ffff:)/i.test(ip);
};

const hostChecks = new Map();
async function assertPublicHost(hostname) {
  if (!hostChecks.has(hostname)) {
    hostChecks.set(hostname, (async () => {
      if (/^(localhost|.*\.local|.*\.internal)$/i.test(hostname)) return false;
      if (isIP(hostname)) return !isPrivate(hostname);
      const addrs = await lookup(hostname, { all: true }).catch(() => null);
      return !!addrs?.length && addrs.every((a) => !isPrivate(a.address));
    })());
  }
  if (!(await hostChecks.get(hostname))) throw new Error(`${hostname} is not a public website.`);
}
// Tests swap this out so they can use made-up hostnames without DNS.
let hostGuard = assertPublicHost;
export const setHostGuard = (fn) => {
  hostGuard = fn || assertPublicHost;
};

// For the headless browser: true only for http(s) addresses on public hosts.
export async function isPublicUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  try {
    await hostGuard(u.hostname.replace(/^\[|\]$/g, ''));
    return true;
  } catch {
    return false;
  }
}

async function readCapped(res, max) {
  if (!res.body) return '';
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    chunks.push(value);
    if (size >= max) {
      reader.cancel().catch(() => {});
      break;
    }
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
}

// Follows up to 6 redirects by hand so every hop is checked as a public address.
export async function safeFetch(fetchImpl, url, { method = 'GET', timeoutMs = FETCH.smallTimeoutMs, redirect = 'follow', read = true, maxBytes = FETCH.maxHtmlBytes } = {}) {
  const started = Date.now();
  const hops = [];
  let current = new URL(url);
  for (let i = 0; i < 7; i++) {
    await hostGuard(current.hostname);
    const left = timeoutMs - (Date.now() - started);
    if (left <= 0) throw new Error('Timed out.');
    const res = await fetchImpl(current.href, {
      method,
      redirect: 'manual',
      signal: AbortSignal.timeout(left),
      headers: { 'User-Agent': FETCH.userAgent, Accept: method === 'HEAD' ? '*/*' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
    });
    const location = res.headers.get('location');
    if (res.status >= 300 && res.status < 400 && location) {
      hops.push({ from: current.href, status: res.status, to: new URL(location, current).href });
      if (redirect === 'manual') return { status: res.status, url: current.href, location: new URL(location, current).href, hops, headers: res.headers, text: '' };
      res.body?.cancel().catch(() => {});
      current = new URL(location, current);
      continue;
    }
    const text = read && method !== 'HEAD' ? await readCapped(res, maxBytes) : (res.body?.cancel().catch(() => {}), '');
    return { status: res.status, url: current.href, hops, headers: res.headers, text, ms: Date.now() - started };
  }
  throw new Error('Too many redirects.');
}

const looksLikeHtml = (r) => /text\/html/i.test(r.headers?.get('content-type') || '') || /^\s*</.test(r.text || '');

// ── robots.txt ──────────────────────────────────────────────────────────────

export function parseRobots(text = '') {
  const groups = [];
  const sitemaps = [];
  let group = null;
  let lastWasAgent = false;
  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'sitemap') {
      if (value) sitemaps.push(value);
      continue;
    }
    if (key === 'user-agent') {
      if (!group || !lastWasAgent) groups.push((group = { agents: [], rules: [] }));
      group.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!group) continue;
    if (key === 'allow' || key === 'disallow') group.rules.push({ allow: key === 'allow', path: value });
  }
  return { groups, sitemaps };
}

function ruleMatches(pattern, path) {
  if (!pattern) return false;
  const anchored = pattern.endsWith('$');
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${body}${anchored ? '$' : ''}`).test(path);
}

export function robotsAllows(robots, agent, path) {
  if (!robots) return true;
  const token = agent.toLowerCase();
  const named = robots.groups.filter((g) => g.agents.some((a) => a !== '*' && token.includes(a)));
  const groups = named.length ? named : robots.groups.filter((g) => g.agents.includes('*'));
  let best = null;
  for (const rule of groups.flatMap((g) => g.rules)) {
    if (rule.path === '' && !rule.allow) continue; // "Disallow:" with nothing means allow everything
    if (!ruleMatches(rule.path, path)) continue;
    if (!best || rule.path.length > best.path.length || (rule.path.length === best.path.length && rule.allow)) best = rule;
  }
  return !best || best.allow;
}

// ── PageSpeed Insights ──────────────────────────────────────────────────────

const METRICS = [
  ['largest-contentful-paint', 'Largest content shows'],
  ['first-contentful-paint', 'First content shows'],
  ['total-blocking-time', 'Time the page is frozen'],
  ['cumulative-layout-shift', 'Layout jumps'],
  ['speed-index', 'Visually complete'],
];

function compactPsi(data, strategy) {
  const lh = data?.lighthouseResult;
  if (!lh) throw new Error('PageSpeed returned no result.');
  const audits = lh.audits || {};
  const perf = lh.categories?.performance?.score;
  const field = data.loadingExperience?.metrics ? data.loadingExperience : null;
  return {
    strategy,
    score: perf == null ? null : Math.round(perf * 100),
    seoScore: lh.categories?.seo?.score == null ? null : Math.round(lh.categories.seo.score * 100),
    metrics: METRICS.map(([id, label]) => ({ id, label, value: audits[id]?.displayValue || null, score: audits[id]?.score ?? null })),
    viewportOk: audits.viewport ? audits.viewport.score === 1 : null,
    fieldData: field ? { category: field.overall_category || null, origin: field.origin_fallback ? 'site' : 'page' } : null,
    screenshot: strategy === 'mobile' ? audits['final-screenshot']?.details?.data || null : null,
    lighthouseVersion: lh.lighthouseVersion || null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function runPageSpeed(fetchImpl, url, strategy, key, timeoutMs = FETCH.pageSpeedTimeoutMs) {
  const qs = new URLSearchParams({ url, strategy });
  qs.append('category', 'performance');
  qs.append('category', 'seo');
  if (key) qs.set('key', key);
  const res = await fetchImpl(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, { signal: AbortSignal.timeout(timeoutMs) });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = data?.error?.message || `PageSpeed answered ${res.status}.`;
    if (res.status === 429) throw new Error(key ? 'PageSpeed daily quota is used up. Try again tomorrow.' : 'PageSpeed needs an API key (PAGESPEED_API_KEY) for reliable runs.');
    throw new Error(reason.split('\n')[0].slice(0, 200));
  }
  return compactPsi(data, strategy);
}

// ── Result helpers ──────────────────────────────────────────────────────────

export function result(key, status, summary, explanation, details = {}) {
  const meta = CHECKS[key];
  return {
    key,
    category: meta.category,
    label: meta.label,
    status,
    score: STATUS_POINTS[status],
    summary,
    explanation,
    impact: meta.impact,
    effort: meta.effort,
    service: SERVICES[meta.service],
    details,
  };
}
export const skipped = (key, reason) =>
  result(key, 'skipped', `Not checked: ${reason}`, `This one could not be checked this time (${reason.replace(/\.$/, '')}). It does not count for or against the site.`, { reason });
const grade = (issues) => (issues === 0 ? 'pass' : issues === 1 ? 'warn' : 'fail');
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
export const errText = (e) => (e?.name === 'TimeoutError' || /abort|timed out/i.test(e?.message || '') ? 'the site took too long to answer' : e?.message || 'an unknown error');

// ── On-page checks ──────────────────────────────────────────────────────────

function checkTitle(page, ctx) {
  const { titles } = page;
  const title = titles[0] || '';
  if (!title) {
    return result('title', 'fail', 'No page title.', `The page title is the blue headline people click in Google. This site does not have one, so Google makes one up. A clear title like "${ctx.service} in ${ctx.city} | ${ctx.business}" improves your chances of being clicked.`, { titles });
  }
  const t = THRESHOLDS.title;
  const issues = [];
  if (titles.length > 1) issues.push(`The page has ${titles.length} titles, so Google has to guess.`);
  if (title.length > t.maxLength) issues.push(`It is ${title.length} characters, so Google cuts it off after about ${t.maxLength}.`);
  if (title.length < t.minLength) issues.push(`At ${title.length} characters it is too short to say what the business does.`);
  const hasCity = mentions(title, ctx.cityName);
  const hasService = mentions(title, ctx.service);
  if (!hasService) issues.push(`It does not say "${ctx.service}".`);
  if (!hasCity) issues.push(`It does not mention ${ctx.cityName}.`);
  const status = grade(issues.length);
  const explanation =
    status === 'pass'
      ? `The title names the service and the city and fits in Google's results. That is what people scan before they click.`
      : `The page title is the blue headline in Google results. ${issues.join(' ')} Someone searching for ${ctx.service.toLowerCase()} in ${ctx.cityName} may scroll past it.`;
  return result('title', status, status === 'pass' ? `"${title}"` : issues[0], explanation, { title, length: title.length, count: titles.length, hasCity, hasService, issues });
}

function checkMetaDescription(page, ctx) {
  const all = page.descriptions.filter(Boolean);
  const text = all[0] || '';
  if (!text) {
    return result('meta_description', 'fail', 'No description for Google.', `The description is the short paragraph under the title in Google. Without one, Google pulls a random line from the page, which rarely sells the business. A sentence about ${ctx.service.toLowerCase()} in ${ctx.cityName} and how to book would give searchers a reason to click.`, { count: 0 });
  }
  const t = THRESHOLDS.metaDescription;
  const issues = [];
  if (all.length > 1) issues.push(`The page has ${all.length} descriptions.`);
  if (text.length > t.maxLength) issues.push(`It is ${text.length} characters, and Google cuts it off around ${t.maxLength}.`);
  if (text.length < t.minLength) issues.push(`At ${text.length} characters it leaves room unused.`);
  const status = grade(issues.length);
  return result(
    'meta_description',
    status,
    status === 'pass' ? `${text.length} characters, a good length.` : issues[0],
    status === 'pass'
      ? 'The description is a good length, so searchers see the whole thing under the title.'
      : `This is the short paragraph under the title in Google. ${issues.join(' ')} A tighter sentence that names the service and the next step gives people a reason to click.`,
    { description: text, length: text.length, count: all.length, issues },
  );
}

function checkH1(page, ctx) {
  const { h1s } = page;
  if (!h1s.length) {
    return result('h1', 'fail', 'No main heading.', `The main heading tells visitors and Google what the page is about in one line. This page does not have one. A heading like "${ctx.service} in ${ctx.cityName}" helps people know they are in the right place within a second.`, { h1s });
  }
  const issues = [];
  if (h1s.length > 1) issues.push(`There are ${h1s.length} main headings, which blurs what the page is about.`);
  const hasService = h1s.some((h) => mentions(h, ctx.service));
  if (!hasService) issues.push(`The main heading does not say "${ctx.service}".`);
  const status = grade(issues.length);
  return result(
    'h1',
    status,
    status === 'pass' ? `"${h1s[0]}"` : issues[0],
    status === 'pass'
      ? 'There is one main heading and it names the service. Visitors and Google both know what the page is about.'
      : `The main heading is the first line most visitors read. ${issues.join(' ')} When it is clear, fewer people leave before they call.`,
    { h1s, hasService, issues },
  );
}

function checkKeywords(page, ctx) {
  const where = (phrase) => ({
    title: page.titles.some((t) => mentions(t, phrase)),
    heading: page.h1s.some((h) => mentions(h, phrase)) || page.h2s.some((h) => mentions(h, phrase)),
    body: mentions(page.bodyText, phrase),
  });
  const city = where(ctx.cityName);
  const service = where(ctx.service);
  const prominent = (w) => w.title || w.heading;
  const anywhere = (w) => w.title || w.heading || w.body;
  let status = 'pass';
  if (!anywhere(city) || !anywhere(service)) status = 'fail';
  else if (!prominent(city) || !prominent(service)) status = 'warn';
  const missing = [!anywhere(service) && `"${ctx.service}"`, !anywhere(city) && ctx.cityName].filter(Boolean);
  const buried = [anywhere(service) && !prominent(service) && `"${ctx.service}"`, anywhere(city) && !prominent(city) && ctx.cityName].filter(Boolean);
  const summary =
    status === 'pass'
      ? `Names ${ctx.service.toLowerCase()} and ${ctx.cityName} up top.`
      : status === 'fail'
        ? `${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not on the home page.`
        : `${buried.join(' and ')} only ${buried.length > 1 ? 'appear' : 'appears'} in the small print.`;
  const explanation =
    status === 'pass'
      ? `The home page says what the business does and where, in the title and headings. That is the first thing Google matches against a "${ctx.service.toLowerCase()} near me" search.`
      : status === 'fail'
        ? `Google matches searches like "${ctx.service.toLowerCase()} in ${ctx.cityName}" against the words on the page. The home page never says ${missing.join(' or ')}, so it is hard for Google to connect this business with those searches.`
        : `The words are on the page, but not in the title or headings, where Google and visitors look first. Moving them up improves your chances of showing for "${ctx.service.toLowerCase()} in ${ctx.cityName}".`;
  return result('keywords', status, summary, explanation, { city, service, cityName: ctx.cityName, serviceName: ctx.service });
}

function checkImageAlt(page, ctx) {
  const imgs = page.images.filter((a) => !(a.width === '1' && a.height === '1'));
  if (!imgs.length) return result('image_alt', 'pass', 'No images on the home page.', 'There are no images on the home page to describe.', { total: 0, missing: 0 });
  const missing = imgs.filter((a) => a.alt === undefined);
  const empty = imgs.filter((a) => a.alt !== undefined && !a.alt.trim()).length;
  const share = missing.length / imgs.length;
  const status = missing.length === 0 ? 'pass' : share > THRESHOLDS.imageAlt.failShareMissing ? 'fail' : 'warn';
  return result(
    'image_alt',
    status,
    status === 'pass' ? `All ${plural(imgs.length, 'image')} have descriptions.` : `${missing.length} of ${plural(imgs.length, 'image')} have no description.`,
    status === 'pass'
      ? 'Every image has a short text description. Google reads these to understand photos, and screen readers read them aloud.'
      : `Image descriptions tell Google what a photo shows (for example "${ctx.service.toLowerCase()} in ${ctx.cityName}"), and screen readers read them aloud to visitors who cannot see the image. ${Math.round(share * 100)} percent of images have none, so those photos do nothing for search.`,
    { total: imgs.length, missing: missing.length, decorative: empty, examples: missing.slice(0, 8).map((a) => a.src || a['data-src'] || '(no src)') },
  );
}

const sameSite = (a, b) => a.replace(/^www\./, '') === b.replace(/^www\./, '');
const FILE_EXT = /\.(pdf|jpe?g|png|gif|webp|svg|zip|docx?|xlsx?|mp4|mov|mp3)$/i;

function collectLinks(page, base) {
  const internal = new Map();
  const external = new Map();
  for (const a of page.links) {
    const href = (a.href || '').trim();
    if (!href || /^(#|mailto:|tel:|sms:|javascript:|data:)/i.test(href)) continue;
    let u;
    try {
      u = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(u.protocol)) continue;
    u.hash = '';
    const key = u.href;
    if (sameSite(u.hostname, base.hostname)) internal.set(key, u);
    else external.set(key, u);
  }
  return { internal, external };
}

function checkInternalLinks(links, base) {
  const pages = new Set();
  for (const u of links.internal.values()) {
    const path = u.pathname.replace(/\/index\.html?$/, '/').replace(/\/+$/, '') || '/';
    const home = base.pathname.replace(/\/index\.html?$/, '/').replace(/\/+$/, '') || '/';
    if (path === home || FILE_EXT.test(path)) continue;
    pages.add(path + u.search);
  }
  const n = pages.size;
  const t = THRESHOLDS.internalLinks;
  const status = n < t.fail ? 'fail' : n < t.warn ? 'warn' : 'pass';
  return result(
    'internal_links',
    status,
    `Links to ${plural(n, 'other page')}.`,
    status === 'pass'
      ? 'The home page links to the main pages of the site, so visitors and Google can find services, contact details and more.'
      : n === 0
        ? 'The home page does not link to any other pages. That usually means a one-page site, which gives Google one page to rank instead of a page for each service. Each service page is another chance to show up in a search.'
        : `The home page links to only ${plural(n, 'other page')}. Pages for each service, the area served, and contact details give Google more to rank and visitors a clear next step.`,
    { count: n, pages: [...pages].slice(0, 30) },
  );
}

// ── Technical checks ────────────────────────────────────────────────────────

async function checkHttps(ctx) {
  const final = new URL(ctx.finalUrl);
  const active = ctx.page.resources.filter((r) => /^http:\/\//i.test(r.url) && r.kind !== 'image');
  const passive = ctx.page.resources.filter((r) => /^http:\/\//i.test(r.url) && r.kind === 'image');
  let httpRedirects = null;
  try {
    const plain = await safeFetch(ctx.fetch, `http://${final.host}/`, { redirect: 'manual', timeoutMs: FETCH.smallTimeoutMs });
    httpRedirects = !!plain.location && plain.location.startsWith('https://');
  } catch {
    httpRedirects = null; // many hosts refuse plain http entirely, which is fine
  }
  if (final.protocol !== 'https:') {
    return result('https', 'fail', 'The site is not secure (no https).', 'Browsers label this site "Not secure" next to the address. Many visitors leave when they see that, and Google prefers secure sites in results. A free certificate fixes it.', { finalUrl: ctx.finalUrl, httpRedirects });
  }
  if (active.length) {
    return result('https', 'fail', `${plural(active.length, 'file')} load without security.`, 'The page is secure, but some of its scripts or styles load over an insecure connection. Browsers block those, so parts of the page can break and the lock icon can disappear.', { insecure: active.slice(0, 10), httpRedirects });
  }
  if (passive.length || httpRedirects === false) {
    const why = passive.length ? `${plural(passive.length, 'image')} still load over an insecure link, which can remove the lock icon in some browsers.` : 'The insecure (http) address does not send visitors to the secure one, so old links can show a "Not secure" warning.';
    return result('https', 'warn', passive.length ? 'Some images load without security.' : 'The old http address does not redirect.', `The site is secure. ${why}`, { insecure: passive.slice(0, 10), httpRedirects });
  }
  return result('https', 'pass', 'Secure, with the lock icon.', 'The site loads securely, and browsers show the lock icon. Visitors see no warnings.', { httpRedirects });
}

function checkMobile(page, psiMobile, psiError) {
  const vp = page?.viewport || '';
  const hasViewport = /width\s*=\s*device-width/i.test(vp);
  const details = { viewport: vp || null, pageSpeedViewport: psiMobile?.viewportOk ?? null, pageSpeedSeo: psiMobile?.seoScore ?? null };
  if (!page && !psiMobile) return skipped('mobile', psiError || 'the home page could not be read');
  if ((page && !vp) || psiMobile?.viewportOk === false) {
    return result('mobile', 'fail', 'Not set up for phones.', 'The page is not set up to fit phone screens, so visitors have to pinch and zoom. Most local searches happen on a phone, and Google ranks phone-friendly sites first.', details);
  }
  if (page && !hasViewport) {
    return result('mobile', 'warn', 'Phone setup is unusual.', 'The page has a phone setting, but not the standard one, so some phones may show it zoomed out. A quick change makes it fit every screen.', details);
  }
  const note = psiMobile ? '' : ' (Google PageSpeed was not available, so this is based on the page setup alone.)';
  return result('mobile', 'pass', 'Fits phone screens.', `The page is set up to fit phone screens, which is where most local searches happen.${note}`, details);
}

function checkPageSpeed(psi, psiError) {
  const { mobile, desktop } = psi || {};
  if (!mobile && !desktop) return skipped('page_speed', psiError || 'Google PageSpeed did not answer');
  const scores = [mobile?.score, desktop?.score].filter((s) => s != null);
  const worst = Math.min(...scores);
  const t = THRESHOLDS.pageSpeed;
  const status = worst >= t.pass ? 'pass' : worst >= t.warn ? 'warn' : 'fail';
  const lcp = mobile?.metrics?.find((m) => m.id === 'largest-contentful-paint')?.value;
  const summary = `Phone ${mobile?.score ?? 'n/a'}, computer ${desktop?.score ?? 'n/a'} out of 100.`;
  const explanation =
    status === 'pass'
      ? 'The site loads fast on phones and computers. Visitors get to the phone number and the booking button without waiting.'
      : `Google scores this site ${mobile?.score ?? desktop?.score} out of 100 for speed on a phone${lcp ? `, where the main content takes ${lcp} to show` : ''}. People searching on a phone often give up after a few seconds and call the next business instead. ${status === 'fail' ? 'A speed tune-up usually starts with images and heavy scripts.' : 'A few changes can move it into the green.'}`;
  return result('page_speed', status, summary, explanation, { mobile: mobile || null, desktop: desktop || null, cached: psi?.cached || false, error: psiError || null });
}

async function checkSitemap(ctx) {
  const candidates = [...new Set([...(ctx.robots?.sitemaps || []), `${ctx.origin}/sitemap.xml`, `${ctx.origin}/sitemap_index.xml`])].slice(0, 4);
  const tried = [];
  for (const url of candidates) {
    try {
      const r = await safeFetch(ctx.fetch, url, { timeoutMs: FETCH.smallTimeoutMs, maxBytes: 2_000_000 });
      tried.push({ url, status: r.status });
      if (r.status !== 200) continue;
      if (/<(urlset|sitemapindex)\b/i.test(r.text)) {
        const count = (r.text.match(/<loc>/gi) || []).length;
        const index = /<sitemapindex\b/i.test(r.text);
        return result('sitemap', 'pass', `Found, listing ${plural(count, index ? 'sitemap' : 'page')}.`, 'The site has a sitemap, a list of its pages that helps Google find and update every page quickly.', { url, count, index, inRobots: (ctx.robots?.sitemaps || []).includes(url), tried });
      }
      if (!looksLikeHtml(r) && r.text.trim()) {
        return result('sitemap', 'warn', 'A sitemap exists but is not in the usual format.', 'There is a file at the sitemap address, but it is not the standard format Google expects, so it may be ignored.', { url, tried });
      }
    } catch (e) {
      tried.push({ url, error: errText(e) });
    }
  }
  return result('sitemap', 'fail', 'No sitemap.', 'A sitemap is a list of the site\'s pages for Google. Without one, new or updated pages can take longer to show up in search. It takes minutes to add.', { tried });
}

function checkRobots(ctx) {
  const r = ctx.robotsResponse;
  if (ctx.robotsError) return skipped('robots', ctx.robotsError);
  if (!r || r.status === 404 || r.status === 410 || (r.status === 200 && looksLikeHtml(r)) || (r.status === 200 && !r.text.trim())) {
    return result('robots', 'fail', 'No robots.txt file.', 'robots.txt is a small file that tells Google which pages to read and where the sitemap is. Without it, Google still visits, but has less guidance. It is a two-minute fix.', { status: r?.status ?? null });
  }
  if (r.status >= 500) return result('robots', 'warn', 'robots.txt gives a server error.', 'When this file errors, Google may pause reading the site until it works again. It should load normally.', { status: r.status });
  if (r.status !== 200) return result('robots', 'warn', `robots.txt answered ${r.status}.`, 'The robots.txt file does not load normally, so Google gets mixed signals about what it may read.', { status: r.status });
  const blocksAll = !robotsAllows(ctx.robots, 'Googlebot', '/') || !robotsAllows(ctx.robots, '*', '/');
  if (blocksAll) {
    return result('robots', 'fail', 'robots.txt blocks the whole site.', 'This file tells Google not to read any page on the site. As long as it does, the site cannot show up in search at all. This is often left over from when the site was being built.', { status: 200, sitemaps: ctx.robots.sitemaps });
  }
  return result('robots', 'pass', ctx.robots.sitemaps.length ? 'In place, and points to the sitemap.' : 'In place.', 'The robots.txt file lets Google read the site.', { status: 200, sitemaps: ctx.robots.sitemaps, groups: ctx.robots.groups.length });
}

async function pool(items, size, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }));
  return out;
}

async function checkBrokenLinks(ctx, links) {
  const t = THRESHOLDS.brokenLinks;
  const internal = [...links.internal.values()].filter((u) => robotsAllows(ctx.robots, FETCH.robotsAgent, u.pathname + u.search));
  const external = [...links.external.values()];
  const list = [...internal, ...external].slice(0, t.maxChecked);
  if (!list.length) return result('broken_links', 'pass', 'No links to check.', 'The home page has no links to test.', { checked: 0 });
  const results = await pool(list, t.concurrency, async (u) => {
    const isInternal = links.internal.has(u.href);
    try {
      let r = await safeFetch(ctx.fetch, u.href, { method: 'HEAD', timeoutMs: t.timeoutMs, read: false });
      if ([403, 405, 501].includes(r.status) || (r.status === 404 && !isInternal)) r = await safeFetch(ctx.fetch, u.href, { timeoutMs: t.timeoutMs, maxBytes: 4096 });
      return { url: u.href, status: r.status, internal: isInternal };
    } catch (e) {
      return { url: u.href, status: null, error: errText(e), internal: isInternal };
    }
  });
  const broken = results.filter((r) => r.status === 404 || r.status === 410 || (r.status >= 500 && r.status < 600));
  const unreachable = results.filter((r) => r.status == null && r.internal);
  const unverifiable = results.filter((r) => [401, 403, 429, 999].includes(r.status) || (r.status == null && !r.internal));
  if (broken.length) {
    return result('broken_links', 'fail', `${plural(broken.length, 'broken link')} on the home page.`, `Some links on the home page lead to "page not found" errors. Visitors who click them hit a dead end, and Google sees a site that is not kept up. ${broken.length === 1 ? 'It is' : 'They are'} listed below.`, { checked: results.length, broken, unverifiable: unverifiable.length, capped: links.internal.size + links.external.size > list.length });
  }
  if (unreachable.length) {
    return result('broken_links', 'warn', `${plural(unreachable.length, 'link')} did not answer.`, 'A few links on the site did not load in time. They may be slow rather than broken, but visitors would wait too.', { checked: results.length, unreachable, unverifiable: unverifiable.length });
  }
  return result('broken_links', 'pass', `All ${plural(results.length, 'link')} work.`, 'Every link on the home page goes somewhere real.', { checked: results.length, unverifiable: unverifiable.length, capped: links.internal.size + links.external.size > list.length });
}

// ── Local: LocalBusiness structured data ────────────────────────────────────

const LOCAL_TYPES = new Set(
  'LocalBusiness AnimalShelter ArchiveOrganization AutomotiveBusiness AutoBodyShop AutoDealer AutoPartsStore AutoRental AutoRepair AutoWash ChildCare Dentist DryCleaningOrLaundry EmergencyService EmploymentAgency EntertainmentBusiness MovieTheater AmusementPark ArtGallery FinancialService FoodEstablishment Bakery BarOrPub Brewery CafeOrCoffeeShop Restaurant Winery GovernmentOffice HealthAndBeautyBusiness BeautySalon DaySpa HairSalon HealthClub NailSalon TattooParlor HomeAndConstructionBusiness Electrician GeneralContractor HVACBusiness HousePainter Locksmith MovingCompany Plumber RoofingContractor InternetCafe LegalService Attorney Notary Library LodgingBusiness BedAndBreakfast Campground Hostel Hotel Motel Resort VacationRental MedicalBusiness MedicalClinic Optician Pharmacy Physician Physiotherapy MedicalOrganization ProfessionalService RadioStation RealEstateAgent RecyclingCenter SelfStorage ShoppingCenter SportsActivityLocation StadiumOrArena TelevisionStation TouristInformationCenter TravelAgency Store BikeStore BookStore ClothingStore ComputerStore ConvenienceStore FurnitureStore GardenStore GroceryStore HardwareStore HobbyShop HomeGoodsStore JewelryStore LiquorStore MobilePhoneStore MusicStore OfficeEquipmentStore OutletStore PawnShop PetStore ShoeStore SportingGoodsStore TireShop ToyStore WholesaleStore Florist'.split(' '),
);
const isLocalType = (t) => LOCAL_TYPES.has(t) || /(Business|Store|Service|Contractor|Clinic|Restaurant|Shop)$/.test(t);

function nodesOf(value, out = []) {
  if (Array.isArray(value)) value.forEach((v) => nodesOf(v, out));
  else if (value && typeof value === 'object') {
    out.push(value);
    for (const v of Object.values(value)) if (v && typeof v === 'object') nodesOf(v, out);
  }
  return out;
}
const typesOf = (n) => (Array.isArray(n['@type']) ? n['@type'] : [n['@type']]).filter(Boolean).map((t) => String(t).replace(/^https?:\/\/schema\.org\//, ''));

function checkSchema(page, ctx) {
  let invalid = 0;
  const nodes = [];
  for (const raw of page.jsonLd) {
    try {
      nodesOf(JSON.parse(raw), nodes);
    } catch {
      invalid++;
    }
  }
  const local = nodes.find((n) => typesOf(n).some(isLocalType));
  const microLocal = page.microdataTypes.some((t) => isLocalType(t.replace(/^https?:\/\/schema\.org\//, '')));
  if (!local) {
    if (microLocal) return result('schema', 'warn', 'Business details are in an older format.', 'The site describes the business to Google in an older format that is easy to get wrong. Moving it to the current format makes the address, phone and hours easier for Google to trust.', { format: 'microdata', invalid });
    const org = nodes.find((n) => typesOf(n).includes('Organization'));
    return result(
      'schema',
      'fail',
      org ? 'Describes a company, but not a local business.' : 'No business details for Google.',
      `Sites can include a hidden block that tells Google the business name, address, phone, hours and service area in a form it reads directly. ${org ? 'This site has a general company block, but not the local business version that helps with map results.' : 'This site does not have one.'} Adding it improves your chances of showing correct details in local results.`,
      { found: nodes.map(typesOf).flat().slice(0, 12), invalid },
    );
  }
  const address = local.address && typeof local.address === 'object' ? local.address : null;
  const has = {
    name: !!local.name,
    address: !!(address && (address.streetAddress || address.addressLocality)) || typeof local.address === 'string',
    telephone: !!local.telephone,
    url: !!local.url,
    hours: !!(local.openingHoursSpecification || local.openingHours),
    geo: !!local.geo,
    image: !!(local.image || local.logo),
    areaServed: !!local.areaServed,
    priceRange: !!local.priceRange,
    sameAs: !!local.sameAs,
  };
  const required = ['name', 'address', 'telephone'];
  const recommended = ['url', 'hours', 'geo', 'image', 'areaServed', 'priceRange', 'sameAs'];
  const missingRequired = required.filter((k) => !has[k]);
  const recCount = recommended.filter((k) => has[k]).length;
  const LABEL = { name: 'name', address: 'address', telephone: 'phone number', hours: 'hours', geo: 'map location', image: 'logo or photo', areaServed: 'service area', priceRange: 'price range', sameAs: 'social profiles', url: 'website address' };
  const type = typesOf(local)[0];
  if (missingRequired.length) {
    return result('schema', 'fail', `Business details are missing the ${missingRequired.map((k) => LABEL[k]).join(' and ')}.`, `The site tells Google it is a ${type}, but leaves out the ${missingRequired.map((k) => LABEL[k]).join(' and ')}. Those are the details Google checks against the Google Business Profile, so gaps here weaken the match.`, { type, has, invalid });
  }
  if (recCount < 3) {
    const add = recommended.filter((k) => !has[k]).slice(0, 3).map((k) => LABEL[k]);
    return result('schema', 'warn', 'Business details are thin.', `The site gives Google the name, address and phone. Adding the ${add.join(', ')} fills in the picture for map results.`, { type, has, invalid });
  }
  return result('schema', 'pass', `Describes the business as a ${type}.`, 'The site tells Google the business name, address, phone and more in the format it reads directly.', { type, has, invalid });
}

// ── Name, address and phone facts (compared with Google in api/_lib/seo-local.mjs) ──

const PHONE = /(?:\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/g;
const STREET = /\b\d{1,6}\s+(?:[NSEW]\.?\s+)?[A-Za-z0-9.' ]{2,40}?\s(?:St|Street|Rd|Road|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Hwy|Highway|Ct|Court|Pkwy|Parkway|Pl|Place|Cir|Circle|Pike|Trl|Trail|Ter|Terrace|Sq|Square)\b\.?/gi;
export const phoneDigits = (s = '') => String(s).replace(/\D/g, '').slice(-10);

// Small, saved facts about what the home page says about the business, so the comparison
// with the Google Business Profile can be run again later without fetching the page.
export function siteFacts(page) {
  if (!page) return null;
  const nodes = [];
  for (const raw of page.jsonLd) {
    try {
      nodesOf(JSON.parse(raw), nodes);
    } catch {
      /* counted by the schema check */
    }
  }
  const local = nodes.find((n) => typesOf(n).some(isLocalType)) || null;
  const a = local?.address;
  const schemaAddress = typeof a === 'string' ? a : a && typeof a === 'object' ? [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter(Boolean).join(', ') : '';
  const phones = new Set();
  for (const l of page.links) if (/^tel:/i.test(l.href)) phones.add(phoneDigits(l.href));
  if (local?.telephone) phones.add(phoneDigits(local.telephone));
  for (const m of page.bodyText.matchAll(PHONE)) phones.add(m[1] + m[2] + m[3]);
  const streets = [...new Set([...page.bodyText.matchAll(STREET)].map((m) => squash(m[0])))];
  const text = page.bodyText;
  return {
    schemaName: typeof local?.name === 'string' ? squash(local.name) : null,
    schemaAddress: squash(schemaAddress) || null,
    phones: [...phones].filter((p) => p.length === 10).slice(0, 10),
    streets: streets.slice(0, 10),
    postalCodes: [...new Set([...`${schemaAddress} ${text}`.matchAll(/\b(\d{5})(?:-\d{4})?\b/g)].map((m) => m[1]))].slice(0, 10),
    // The title, headings and the start and end of the page, where names and footers live.
    brandText: squash([page.titles[0], page.h1s[0], local?.name, text.slice(0, 400), text.slice(-1500)].filter((v) => typeof v === 'string').join(' ')).slice(0, 2400),
  };
}

// ── The audit ───────────────────────────────────────────────────────────────

export const PHASE_ONE = Object.keys(CHECKS).filter((k) => CHECKS[k].phase === 1);

// input: { url, business, city, service }
// deps:  { fetch, pageSpeedKey, cachedPageSpeed(url) -> {mobile, desktop} | null, render(url) -> html | null, budgetMs }
export async function runAudit(input, deps = {}) {
  const started = Date.now();
  hostChecks.clear();
  const fetchImpl = deps.fetch || globalThis.fetch;
  const budget = deps.budgetMs ?? FETCH.auditBudgetMs;
  const timeLeft = () => budget - (Date.now() - started);
  const start = normalizeUrl(input.url);
  const ctx = {
    fetch: fetchImpl,
    business: squash(input.business || ''),
    city: squash(input.city || ''),
    cityName: cityName(input.city || ''),
    service: squash(input.service || ''),
    origin: start.origin,
  };
  const notes = [];

  // PageSpeed starts first: it is the slowest step and runs alongside everything else.
  const psiPromise = (async () => {
    const cached = deps.cachedPageSpeed ? await deps.cachedPageSpeed(start.href).catch(() => null) : null;
    if (cached?.mobile || cached?.desktop) return { ...cached, cached: true };
    const timeout = Math.max(5000, Math.min(FETCH.pageSpeedTimeoutMs, timeLeft() - 2000));
    const [mobile, desktop] = await Promise.allSettled([
      runPageSpeed(fetchImpl, start.href, 'mobile', deps.pageSpeedKey, timeout),
      runPageSpeed(fetchImpl, start.href, 'desktop', deps.pageSpeedKey, timeout),
    ]);
    const error = [mobile, desktop].find((r) => r.status === 'rejected')?.reason;
    return {
      mobile: mobile.status === 'fulfilled' ? mobile.value : null,
      desktop: desktop.status === 'fulfilled' ? desktop.value : null,
      cached: false,
      error: error ? errText(error) : null,
    };
  })().catch((e) => ({ mobile: null, desktop: null, error: errText(e) }));

  // robots.txt first, so the home page is only fetched if it allows us.
  try {
    ctx.robotsResponse = await safeFetch(fetchImpl, `${start.origin}/robots.txt`, { timeoutMs: FETCH.smallTimeoutMs, maxBytes: 500_000 });
    ctx.robots = ctx.robotsResponse.status === 200 && !looksLikeHtml(ctx.robotsResponse) ? parseRobots(ctx.robotsResponse.text) : null;
  } catch (e) {
    ctx.robotsError = errText(e);
    if (/not a public website/.test(e.message)) throw new AuditInputError(e.message);
  }

  let homeError = null;
  const homePath = start.pathname + start.search;
  if (ctx.robots && !robotsAllows(ctx.robots, FETCH.robotsAgent, homePath)) {
    homeError = "the site's robots.txt asks tools like this one not to read the page";
  } else {
    try {
      const home = await safeFetch(fetchImpl, start.href, { timeoutMs: FETCH.pageTimeoutMs });
      ctx.finalUrl = home.url;
      ctx.redirects = home.hops;
      ctx.homeStatus = home.status;
      if (home.status >= 400) homeError = `the home page answered with error ${home.status}`;
      else {
        ctx.rawHtml = home.text;
        ctx.page = readPage(home.text);
        ctx.homeMs = home.ms;
      }
    } catch (e) {
      homeError = errText(e);
    }
  }

  // JavaScript apps (Vite, React and similar) ship an empty page and draw it in the browser.
  // Google runs the JavaScript, so read the page the same way before judging its content.
  if (ctx.page && deps.render && ctx.page.bodyText.length < FETCH.spaTextThreshold && ctx.page.moduleScripts > 0 && timeLeft() > 20000) {
    try {
      const html = await deps.render(ctx.finalUrl, Math.min(FETCH.renderTimeoutMs, timeLeft() - 15000));
      if (html) {
        const rendered = readPage(html);
        if (rendered.bodyText.length > ctx.page.bodyText.length) {
          // Keep the server's own <head> facts for things JavaScript should not be trusted with.
          ctx.page = { ...rendered, resources: [...ctx.page.resources, ...rendered.resources] };
          ctx.rendered = true;
          notes.push('This site builds its pages with JavaScript, so it was read after the JavaScript ran, the way Google reads it.');
        }
      }
    } catch (e) {
      notes.push(`The page could not be rendered with JavaScript (${errText(e)}), so content checks used the raw page.`);
    }
  }

  const checks = [];
  const add = async (key, fn) => {
    try {
      if (timeLeft() <= 0) return checks.push(skipped(key, 'the review ran out of time'));
      checks.push(await fn());
    } catch (e) {
      checks.push(skipped(key, errText(e)));
    }
  };

  if (ctx.page) {
    const base = new URL(ctx.finalUrl);
    const links = collectLinks(ctx.page, base);
    await add('title', () => checkTitle(ctx.page, ctx));
    await add('meta_description', () => checkMetaDescription(ctx.page, ctx));
    await add('h1', () => checkH1(ctx.page, ctx));
    await add('keywords', () => checkKeywords(ctx.page, ctx));
    await add('image_alt', () => checkImageAlt(ctx.page, ctx));
    await add('internal_links', () => checkInternalLinks(links, base));
    await Promise.all([
      add('https', () => checkHttps(ctx)),
      add('sitemap', () => checkSitemap(ctx)),
      add('broken_links', () => checkBrokenLinks(ctx, links)),
    ]);
    await add('schema', () => checkSchema(ctx.page, ctx));
  } else {
    for (const key of ['title', 'meta_description', 'h1', 'keywords', 'image_alt', 'internal_links', 'https', 'broken_links', 'schema']) checks.push(skipped(key, homeError || 'the home page could not be read'));
    await add('sitemap', () => checkSitemap(ctx));
  }
  await add('robots', () => checkRobots(ctx));

  let timer;
  const psi = await Promise.race([
    psiPromise,
    new Promise((r) => {
      timer = setTimeout(() => r({ mobile: null, desktop: null, error: 'Google PageSpeed took too long' }), Math.max(0, timeLeft()));
    }),
  ]);
  clearTimeout(timer);
  await add('mobile', () => checkMobile(ctx.page, psi.mobile, psi.error));
  await add('page_speed', () => checkPageSpeed(psi, psi.error));

  const order = PHASE_ONE;
  checks.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return {
    site: {
      requestedUrl: start.href,
      finalUrl: ctx.finalUrl || start.href,
      redirects: ctx.redirects || [],
      homeStatus: ctx.homeStatus ?? null,
      homeMs: ctx.homeMs ?? null,
      rendered: !!ctx.rendered,
      title: ctx.page?.titles?.[0] || null,
      error: homeError,
      nap: siteFacts(ctx.page),
    },
    pageSpeedFetched: !psi.cached && !!(psi.mobile || psi.desktop),
    notes,
    checks,
    durationMs: Date.now() - started,
  };
}
