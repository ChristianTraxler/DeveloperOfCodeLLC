# SEO Review (admin tool)

Served at `/admin/seo/` behind the admin login. Built by `npm run build:seo` (part of the main
`npm run build`) into `public/admin/seo/`, which is git-ignored like the other tools.

Phase 1 of the Local SEO Review build brief: the review form, 13 of the 18 checks, Google
PageSpeed, and saving every review to Supabase. Scoring, the Next Steps list, the client share
page and PDF come in Phase 2. Google Business Profile, reviews, NAP, rank and competitors in Phase 3.

## Where things live

| Path | What it holds |
| --- | --- |
| `api/seo.mjs` | The Vercel Function: sign-in check, run, list, get, delete. Saves to Supabase. |
| `api/_lib/seo-config.mjs` | Every threshold, category weight, impact and effort rating, and linked service. Tune here. |
| `api/_lib/seo-checks.mjs` | The checks. A check that fails to run is saved as "skipped" and the review still finishes. |
| `api/_lib/seo-html.mjs` | Small HTML reader (no new dependencies). |
| `api/_lib/seo-render.mjs` | Reads JavaScript-built sites (Vite, React) in headless Chromium, the way Google does. |
| `supabase/seo.sql` | Tables and RLS. Run once in the SQL Editor. Safe to re-run. |
| `tests/seo.test.mjs` | `npm run test:seo`. No network needed. |
| `src/features/seo/` | The screens. `seoApi.js` is the only file that calls the server. |

## Go live

1. Supabase, SQL Editor: run `supabase/seo.sql`.
2. Vercel env vars: add `PAGESPEED_API_KEY` (free: Google Cloud console, enable "PageSpeed Insights API",
   then Credentials, Create API key, and restrict it to that API). `SUPABASE_SERVICE_ROLE_KEY` and
   `ADMIN_EMAILS` are already there for Marketing and Demos.
3. Deploy. The Hub shows the SEO Review card.

Without the PageSpeed key the page speed check is skipped and everything else runs.

## How a review runs

1. robots.txt first. If it asks tools not to read the home page, the page is not fetched.
2. The home page, following redirects. If it is a JavaScript app with almost no text in the raw
   HTML, it is rendered in Chromium before the content checks.
3. Title, description, main heading, city and service, image descriptions, links to other pages,
   https, sitemap, robots.txt, broken links (first 40 links, HEAD with GET fallback), LocalBusiness data.
4. PageSpeed mobile and desktop run in parallel from the start, cached per address for 24 hours.
5. Everything has to finish in 52 seconds so the function stays inside Vercel's 60 second limit.
   Anything still running is saved as skipped.

## Local work

```bash
npm run dev:demo    # the screens on saved sample reviews, no server or sign in
npm run dev:open    # the screens against a local api (SEO_API=http://localhost:5173 from the root dev server)
npm run build:preview   # one self-contained HTML file of the demo, in preview/
```
