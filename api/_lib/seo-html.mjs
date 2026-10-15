// api/_lib/seo-html.mjs: a small, dependency-free HTML reader for the SEO checks.
// It is not a full parser. It reads the handful of things the checks need (title, meta tags,
// headings, images, links, JSON-LD, visible text) and tolerates messy real-world markup.

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '-', mdash: '-', hellip: '...',
  rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', copy: '(c)', reg: '(r)', trade: '(tm)', middot: '.', bull: '.',
};

export function decode(text = '') {
  return String(text).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code) => {
    if (code[0] === '#') {
      const n = code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
    }
    return NAMED[code.toLowerCase()] ?? m;
  });
}

export const squash = (s = '') => s.replace(/\s+/g, ' ').trim();
const stripTags = (s = '') => s.replace(/<[^>]*>/g, ' ');
export const textOf = (s = '') => squash(decode(stripTags(s)));

// Attribute values may contain ">" inside quotes, so match quoted values explicitly.
const ATTR = String.raw`(?:\s+[^\s=\/>"']+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>"']+))?)*`;
const tagRe = (name) => new RegExp(`<(${name})(${ATTR})\\s*\\/?>`, 'gi');

export function attrs(raw = '') {
  const out = {};
  const re = /([^\s=\/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
  let m;
  while ((m = re.exec(raw))) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

export function tags(html, name) {
  const out = [];
  const re = tagRe(name);
  let m;
  while ((m = re.exec(html))) out.push({ tag: m[1].toLowerCase(), attrs: attrs(m[2]), raw: m[0] });
  return out;
}

function blocks(html, name) {
  const out = [];
  const re = new RegExp(`<${name}\\b(${ATTR})\\s*>([\\s\\S]*?)<\\/${name}\\s*>`, 'gi');
  let m;
  while ((m = re.exec(html))) out.push({ attrs: attrs(m[1]), inner: m[2] });
  return out;
}

// Everything the checks read from one HTML document.
export function readPage(rawHtml = '') {
  const html = String(rawHtml).replace(/<!--[\s\S]*?-->/g, '');
  const scripts = blocks(html, 'script');
  // svg <title> elements and script text are not page content.
  const clean = html
    .replace(/<(script|style|noscript|template|svg)\b[\s\S]*?<\/\1\s*>/gi, ' ');
  const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head\s*>/i.exec(clean);
  const head = headMatch ? headMatch[1] : clean;
  const bodyMatch = /<body\b[^>]*>([\s\S]*)$/i.exec(clean);
  const body = bodyMatch ? bodyMatch[1].replace(/<\/body\s*>[\s\S]*$/i, '') : clean.replace(/<head\b[\s\S]*?<\/head\s*>/i, '');

  const titles = blocks(head, 'title').map((b) => textOf(b.inner));
  const metas = tags(head, 'meta').map((t) => t.attrs);
  const meta = (name) => metas.filter((a) => (a.name || '').toLowerCase() === name).map((a) => squash(a.content || ''));
  const h1s = blocks(clean, 'h1').map((b) => textOf(b.inner)).filter(Boolean);
  const h2s = blocks(clean, 'h2').map((b) => textOf(b.inner)).filter(Boolean);
  const images = tags(clean, 'img').map((t) => t.attrs);
  const links = tags(clean, 'a').map((t) => t.attrs).filter((a) => a.href != null);
  const jsonLd = scripts
    .filter((s) => /application\/ld\+json/i.test(s.attrs.type || ''))
    .map((s) => s.inner.trim());
  const microdataTypes = [...html.matchAll(/itemtype\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]);
  const moduleScripts = scripts.filter((s) => s.attrs.src || /module/i.test(s.attrs.type || '')).length;
  const bodyText = textOf(body);
  const lang = attrs((/<html\b([^>]*)>/i.exec(html) || [])[1] || '').lang || '';

  // Resources that load from http:// on an https page (mixed content).
  const resources = [
    ...tags(clean, 'img').map((t) => ({ kind: 'image', url: t.attrs.src })),
    ...tags(html, 'script').map((t) => ({ kind: 'script', url: t.attrs.src })),
    ...tags(head, 'link').filter((t) => /stylesheet/i.test(t.attrs.rel || '')).map((t) => ({ kind: 'stylesheet', url: t.attrs.href })),
    ...tags(clean, 'iframe').map((t) => ({ kind: 'frame', url: t.attrs.src })),
    ...tags(clean, 'source').map((t) => ({ kind: 'image', url: t.attrs.src || t.attrs.srcset })),
  ].filter((r) => r.url);

  return {
    titles,
    descriptions: meta('description'),
    viewport: meta('viewport')[0] ?? null,
    robotsMeta: meta('robots')[0] ?? '',
    canonical: tags(head, 'link').find((t) => (t.attrs.rel || '').toLowerCase() === 'canonical')?.attrs.href || null,
    h1s,
    h2s,
    images,
    links,
    jsonLd,
    microdataTypes,
    moduleScripts,
    bodyText,
    lang,
    resources,
  };
}

// Lowercase, accents off, punctuation to spaces.
export const norm = (s = '') =>
  ` ${String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()} `;

const STOP = new Set(['and', 'the', 'for', 'of', 'in', 'a', 'an', 'to', 'services', 'service', 'llc', 'inc', 'co']);

// True when text mentions the phrase: the whole phrase, or every meaningful word by its stem
// (so "pressure washing" matches "Pressure Wash", and "chiropractor" matches "chiropractic").
export function mentions(text, phrase) {
  const t = norm(text);
  const p = norm(phrase).trim();
  if (!p) return false;
  if (t.includes(` ${p} `)) return true;
  const words = p.split(' ').filter((w) => w.length > 2 && !STOP.has(w));
  if (!words.length) return false;
  return words.every((w) => t.includes(` ${stem(w)}`));
}

// Rough English stem: washing, washer, washers -> wash; chiropractor, chiropractic -> chiropract.
export function stem(w) {
  const m = /^(.{4,}?)(ations|ation|ings|ing|ers|er|ors|or|ics|ic|ions|ion|ies|ed|es|al|y|e|s)$/.exec(w);
  return m ? m[1] : w;
}

// "Hickory, NC" and "Hickory NC 28601" both mean Hickory for matching.
export function cityName(city = '') {
  return String(city).split(',')[0].replace(/\b(NC|SC|North Carolina|South Carolina)\b/gi, '').replace(/\d{5}(-\d{4})?/, '').trim() || String(city).trim();
}
