# Developer of Code, LLC

Marketing site for Developer of Code, LLC, the veteran-owned web design and development studio run by Christian Traxler in North Carolina. Four pages: the home page (`index.html`), the project intake form (`intake.html`), the shop (`products.html`), and the Relay launch sign-up (`notify.html`).

The same repo also serves the private `/admin` hub and the Projects Tracker. The previous site lives in `archive/legacy-site/` for reference; nothing in it is built or deployed.

## Stack

- Vite, React 18, Tailwind CSS 3
- Literata and Mona Sans variable fonts, self-hosted (SIL Open Font License, latin subset)
- Three Vercel Functions in `api/` (no npm dependencies): the notify sign-up mailer, the status proxy, and the Supabase keep-alive
- No other runtime dependencies

## Scripts

```bash
npm install
npm run dev            # local dev server
npm run build          # production build of all four pages in dist/, ready for Vercel or Netlify
npm run build:single   # one self-contained HTML file per page in dist-single/, every asset inlined
npm run preview        # serve dist/ locally
```

## Forms and email

| Page | Sends through | Needs |
| --- | --- | --- |
| `intake.html` | Web3Forms, straight from the browser (`src/intakeForm.js` holds the access key, subject, and every field name, unchanged from the old form) | Nothing server-side |
| `notify.html` | `POST /api/notify` (`api/notify.mjs`), which sends a branded confirmation to the visitor and a copy to you through Resend | `RESEND_API_KEY`, optional `NOTIFY_FROM` and `NOTIFY_TO` |
| Footer badge | `GET /api/status` (`api/status.mjs`), a same-origin proxy in front of status.developerofcode.com | Nothing; optional `STATUS_PAGE_URL` |
| Cron | `GET /api/keep-alive` (`api/keep-alive.mjs`) daily at 06:00 UTC, scheduled in `vercel.json` | Nothing; optional `CRON_SECRET` |

Locally, `npm run dev` serves `api/*.mjs` at `/api/*` (see `scripts/vite-plugins.mjs`), so copy `.env.example` to `.env.local`, add your Resend key, and the notify form sends for real from the dev server. The single-file previews skip all of this and explain that instead.

## Deploying

- Vercel: pushes to `main` deploy through `.github/workflows/deploy-vercel.yml`. `vercel.json` sets the Vite preset, `npm run build`, the `dist` output, the Tracker rewrite, redirects for the retired product pages, and the cron. Add the env vars from `.env.example` under Project → Settings → Environment Variables. The `api/` folder deploys as functions automatically.
- Netlify or any static host: `dist/` works as-is for the pages, but `/api/*` will not exist, so the notify form fails and the badge stays neutral. Keep the Vercel functions or point `ENDPOINT` in `src/pages/NotifyPage.jsx` at wherever you host `api/notify.mjs`.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/content.js` | All copy, links, projects, services, steps, testimonials, and products |
| `src/components/` | One component per home page section, plus the shared header, footer, page hero, form fields, product sketches, and back-to-top button |
| `src/pages/` | The intake form page, the shop page, and the notify page |
| `src/intakeForm.js` | Every intake question, its options, which ones are required, and the Web3Forms settings |
| `src/site.js` | Where each page lives, for the preview build and for the live site |
| `src/index.css` | Color tokens, type scale, and section styles |
| `src/assets/img/` | Photography, client screenshots, testimonial photos, logo, signature |
| `src/assets/fonts/` | Self-hosted variable fonts |
| `public/` | Copied into `dist/` as-is: favicons, `og.jpg`, `robots.txt`, `sitemap.xml`, plus everything the old site served that still has to live at the same URL |
| `public/admin/`, `public/admin.webmanifest`, `public/js/pwa.js` | The `/admin` hub and login. `public/admin/tracker/` is build output from `tools/project-tracker` and is gitignored |
| `public/img/` | The old site's image folder, kept at `/img/` because the admin icons, the home page's structured data logo, and outside links point into it |
| `tools/project-tracker/` | The Projects Tracker app served at `/admin/tracker/` |
| `archive/legacy-site/` | The previous static site, kept for reference only |
| `docs/` | Design notes and `admin-setup.md` for the admin hub and Supabase |
| `api/` | Vercel Functions: `notify.mjs` (Resend mailer), `status.mjs` (status badge proxy), `keep-alive.mjs` (Supabase cron ping) |
| `scripts/vite-plugins.mjs` | Dev-only `/api/*` bridge and the production-only Google Tag Manager injection |
| `vercel.json` | Framework, output directory, and the daily keep-alive cron |
| `.env.example` | Every server-side env var the functions read |
| `index.html`, `intake.html`, `products.html`, `notify.html` | Page entry points with each page's title and link preview tags |
| `preview/` | The four self-contained single-file builds, the same pages as the shared links |

## Design notes

- Concept: Built for Main Street. The logo orange becomes the lamp left on in a shop window at blue hour. On load the window light flickers on once. That is the only automatic motion; everything else responds to the visitor.
- Palette: Blue Hour `#112448`, Limestone `#F1F1EE`, Ink `#14213D`, Lamp `#FF7A38`, Night `#0A1328`.
- Type: Literata Light for headlines and quotes. Mona Sans at a wide setting for navigation, labels, and body copy.
- Light sections follow the visitor's light or dark preference. Blue hour sections and photos stay as they are.
- The back-to-top button appears after the hero. Its ring fills with lamp orange as you scroll, and it returns keyboard focus to the headline.
- All motion respects `prefers-reduced-motion`.
- Inner pages open in the same blue hour sky, above a strip of the Main Street rooflines from the hero photo.
- Intake form: a progress rail follows you down the page and marks each section complete as its answers come in. Options are cards and chips instead of tiny radio buttons, the online store section turns on by itself when a store feature is picked, and follow-up questions (which domain, what event) only appear when they apply. Unsent answers are saved in the visitor's browser and cleared after a successful send.
- Shop: each product gets a small interface sketch drawn in code, in the site palette, so nothing depends on screenshots of unreleased software.
- Notify page: the Relay sketch is the one lit screen in the blue hour sky. Picking a product swaps the sketch, the headline, and the product details. A `?product=` link (like the ones on the shop) preselects it, and with nothing picked the page shows both products together.

## Before going live

- Links between pages: `npm run build` links pages with normal site paths (`/`, `/intake.html`, `/products.html`, `/notify.html`), so nothing needs changing for the live site. `npm run build:single` links the four published claude.ai previews to each other instead. Those addresses live in `src/site.js`.
- The intake form sends through Web3Forms with the same access key and the same field names as the old form, so submissions arrive in the same format. Preview pages on claude.ai can't send forms, so the preview explains that instead of sending. The deployed site sends normally.
- The notify page sends the same data as the old one (`product`, `name`, `email`, and the `botcheck` honeypot, as JSON) to `/api/notify`. That Resend function now lives in this project's `api/` folder; set `RESEND_API_KEY` in Vercel before launch. With no product picked it sends `General (no product specified)`, same as before. Preview pages on claude.ai can't send sign-ups, so the preview explains that instead.
- Google Tag Manager (`GTM-K2CNPHK`) is injected into all four pages by `npm run build` only. Dev and the single-file previews never load it. Change or clear `GTM_ID` in `vite.config.js`.
- The footer's live status badge reads `/api/status`. Until status.developerofcode.com answers, it shows a neutral "System status" link, never a claimed green.
- The hero street, lake, and storefront door photos were generated with Higgsfield. Swap in real photography any time. In the hero, keep the rooflines in the upper third so the headline stays in the sky, and update `--bldg` in `src/index.css` (the share of the photo from the rooflines down) if the roofline moves. The lit window overlay positions live in `src/components/Hero.jsx`.
- Client site screenshots were captured on September 27, 2026. Refresh them when those sites change.
- `og.jpg` is referenced as `https://developerofcode.com/og.jpg`. Update the URL in `index.html` if the domain changes.
