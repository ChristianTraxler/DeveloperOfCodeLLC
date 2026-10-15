// api/_lib/seo-config.mjs: every number the SEO Review tool scores against, in one place.
//
// Tune thresholds, category weights, and each check's impact, effort and linked service here.
// Nothing else in the code hard-codes them. The admin UI reads labels and services from the
// API response, so a change here shows up everywhere after the next deploy.

// Points per status. A check earns full points for pass, half for warn, none for fail.
// Skipped checks drop out of the math entirely (Phase 2 rolls these up).
export const STATUS_POINTS = { pass: 1, warn: 0.5, fail: 0, skipped: null };

// Category weights for the overall score (Phase 2). They total 100. If rank data is not
// entered, visibility drops out and the rest are rescaled to 100.
export const CATEGORIES = {
  onpage: { label: 'On-page', weight: 25, blurb: 'What the home page tells Google about the business.' },
  technical: { label: 'Technical', weight: 25, blurb: 'Whether the site is fast, secure and easy for Google to read.' },
  local: { label: 'Local signals', weight: 30, blurb: 'The details Google uses to place a business on the map.' },
  visibility: { label: 'Visibility and competitors', weight: 20, blurb: 'Where the business shows up next to nearby competitors.' },
};

// What Developer of Code sells. Every check links to one of these.
export const SERVICES = {
  onpage: 'On-page fixes',
  content: 'Service page copy',
  speed: 'Speed tune-up',
  technical: 'Technical cleanup',
  mobile: 'Mobile-first rebuild',
  schema: 'Local search setup',
  gbp: 'Google Business Profile setup',
  reviews: 'Review request system',
  care: 'Website Care + Local SEO',
};

// The 18 checks. phase says when each one starts running. impact is how much fixing it likely
// helps local visibility; effort is the owner's time to fix it (small, medium, large).
export const CHECKS = {
  title: { label: 'Title tag', category: 'onpage', phase: 1, impact: 'high', effort: 'small', service: 'onpage' },
  meta_description: { label: 'Meta description', category: 'onpage', phase: 1, impact: 'medium', effort: 'small', service: 'onpage' },
  h1: { label: 'Main heading', category: 'onpage', phase: 1, impact: 'medium', effort: 'small', service: 'onpage' },
  keywords: { label: 'City and service on the page', category: 'onpage', phase: 1, impact: 'high', effort: 'medium', service: 'content' },
  image_alt: { label: 'Image descriptions', category: 'onpage', phase: 1, impact: 'low', effort: 'small', service: 'onpage' },
  internal_links: { label: 'Links to other pages', category: 'onpage', phase: 1, impact: 'medium', effort: 'medium', service: 'content' },

  https: { label: 'Secure connection', category: 'technical', phase: 1, impact: 'high', effort: 'small', service: 'technical' },
  mobile: { label: 'Works on phones', category: 'technical', phase: 1, impact: 'high', effort: 'large', service: 'mobile' },
  page_speed: { label: 'Page speed', category: 'technical', phase: 1, impact: 'high', effort: 'medium', service: 'speed' },
  sitemap: { label: 'Sitemap', category: 'technical', phase: 1, impact: 'low', effort: 'small', service: 'technical' },
  robots: { label: 'robots.txt', category: 'technical', phase: 1, impact: 'medium', effort: 'small', service: 'technical' },
  broken_links: { label: 'Broken links', category: 'technical', phase: 1, impact: 'medium', effort: 'small', service: 'technical' },

  schema: { label: 'Business details for Google', category: 'local', phase: 1, impact: 'high', effort: 'small', service: 'schema' },
  nap: { label: 'Name, address and phone match', category: 'local', phase: 3, impact: 'high', effort: 'small', service: 'schema' },
  gbp: { label: 'Google Business Profile', category: 'local', phase: 3, impact: 'high', effort: 'medium', service: 'gbp' },
  reviews: { label: 'Google reviews', category: 'local', phase: 3, impact: 'high', effort: 'large', service: 'reviews' },

  rank: { label: 'Rank for service and city', category: 'visibility', phase: 3, impact: 'high', effort: 'large', service: 'care' },
  competitors: { label: 'Top 3 local competitors', category: 'visibility', phase: 3, impact: 'medium', effort: 'large', service: 'care' },
};

// Starting thresholds. Tune freely.
export const THRESHOLDS = {
  title: { maxLength: 60, minLength: 15 },
  metaDescription: { maxLength: 160, minLength: 70 },
  imageAlt: { failShareMissing: 0.2 }, // more than 20 percent of images with no alt attribute fails
  internalLinks: { fail: 3, warn: 5 }, // unique pages linked from the home page
  pageSpeed: { pass: 90, warn: 50 }, // Lighthouse performance score: 90+ pass, 50 to 89 warn, under 50 fail
  brokenLinks: { maxChecked: 40, concurrency: 6, timeoutMs: 6000 },
};

// How the server fetches sites.
export const FETCH = {
  userAgent: 'Mozilla/5.0 (compatible; DOCSEOReview/1.0; +https://developerofcode.com)',
  robotsAgent: 'DOCSEOReview', // the token matched against robots.txt groups
  pageTimeoutMs: 12000,
  smallTimeoutMs: 6000,
  maxHtmlBytes: 3_000_000,
  // Phase 1 must finish inside Vercel's 60 second limit. Work still running at this point is skipped.
  auditBudgetMs: 52000,
  pageSpeedTimeoutMs: 45000,
  pageSpeedCacheHours: 24,
  // A home page with less visible text than this, plus a script bundle, is treated as a JavaScript
  // app and read again in headless Chromium, the way Google renders it.
  spaTextThreshold: 200,
  renderTimeoutMs: 15000,
};
