# Admin Login + Tools Hub — Design

Date: 2026-05-24
Status: Approved, implementing

## Goal

Add a secure admin login to the Developer Of Code site that, once authenticated,
acts as a hub to internal tools — starting with the DOC Projects Tracker. One
login covers everything, served from a single origin (`developerofcode.com`).

## Decisions

- **Auth:** Supabase Auth (email + password), against a dedicated Supabase
  project under the Developer Of Code account. Invite-only — no public signup.
- **Topology:** Hub + tools on **one domain**. Tracker served at
  `/admin/tracker`, so the Supabase session (in `localStorage` for the origin)
  is shared everywhere — sign in once.
- **Build:** Build at deploy on Vercel. Tracker source lives in the repo; Vite
  compiles it into `admin/tracker/` on every push. Static HTML unchanged.

## Repo layout

```
DeveloperOfCodeLLC-master/
├── index.html, products.html, ...   ← existing static site, untouched
├── api/notify.mjs                   ← existing (zero npm deps, uses fetch)
├── admin/
│   ├── login.html                   ← Supabase sign-in page (static)
│   ├── index.html                   ← hub: tool cards, sign out, scroll-to-top
│   ├── supabase.js                  ← shared client (URL + public anon key)
│   └── tracker/                     ← Vite build output (gitignored)
├── tools/
│   └── project-tracker/             ← Tracker React source (committed)
├── package.json                     ← root, orchestrates the build
└── vercel.json                      ← buildCommand + SPA rewrite
```

## Build pipeline

Root `package.json`:

```json
{ "scripts": { "build": "npm --prefix tools/project-tracker install && npm --prefix tools/project-tracker run build" } }
```

`vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": ".",
  "rewrites": [
    { "source": "/admin/tracker/(.*)", "destination": "/admin/tracker/index.html" }
  ]
}
```

Tracker `vite.config.js`: `base: '/admin/tracker/'`, `build.outDir: '../../admin/tracker'`, `emptyOutDir: true`.
Tracker router: `<BrowserRouter basename="/admin/tracker">`.
Vercel checks real files before applying rewrites, so assets load and only SPA
routes fall through to `index.html`.

## Auth flow

```
/admin (hub) ── no session ──► /admin/login.html ── signInWithPassword ──► /admin
/admin/tracker/ ── AuthGate checks getSession() ── none ──► /admin/login.html
```

**Real lock = Supabase RLS, not redirects.** Tracker tables currently allow
`anon` full access. We replace those with authenticated-only policies, so any
direct hit to `/admin/tracker/` is rejected by Supabase without a valid token.

```sql
create policy "authed all projects" on projects
  for all using (auth.uid() is not null) with check (auth.uid() is not null);
-- same for tasks, time_entries, notes, and storage.objects
```

## UI

Both static pages match the site design system (dark, `#ff4500` accent,
Syne + DM Sans, `</DOC>` mark, grid-glow bg).

- **login.html** — centered card, email + password, inline errors. Redirects to
  hub if already signed in. Single viewport.
- **index.html** — top bar (`</DOC> Admin`, email, Sign out), grid of tool
  cards (Projects Tracker → `/admin/tracker/`, plus an "add a tool" placeholder).
  Redirects to login if no session. Includes a scroll-to-top button
  (fixed bottom-right, appears past ~300px, smooth scroll respecting
  `prefers-reduced-motion`, `aria-label="Scroll to top"`).

## Supabase setup (done by owner; see admin/SETUP.md)

1. Create project; copy Project URL + `anon` public key.
2. Put values in `admin/supabase.js` and Vercel env vars
   `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
3. Run `schema.sql` (if empty) + `policies-auth.sql`.
4. Create admin user (Authentication → Users → Add user).
5. Disable signups (Authentication → Providers → Email).
6. Set Site URL to `https://developerofcode.com`.

## Local dev / deploy

- Static workflow unchanged. Tracker dev: `cd tools/project-tracker && npm run dev`.
- Full integrated preview: `npm run build` at root, then serve root.
- Deploy: `git push` → Vercel builds Tracker into `admin/tracker/`, serves
  static HTML + built app together. Last good deploy stays live if a build fails.

## Build order

1. Repo wiring (move source, package.json, vercel.json, vite/router config, .gitignore).
2. Auth foundation (`admin/supabase.js`, AuthGate in Tracker).
3. `admin/login.html`.
4. `admin/index.html` (hub + scroll-to-top).
5. `policies-auth.sql` + `admin/SETUP.md`.
6. Verify `npm run build` produces `admin/tracker/` and leaves static site intact.
