# Outlay

The expense ledger for Developer of Code, LLC, served at `/admin/outlay/` as a tool on the Admin Hub. Vite, React 18, Tailwind 3, built mobile first.

## How it fits the admin

- **Auth and client:** Outlay has no login and no Supabase client of its own. `src/data/supabaseClient.js` loads the admin's shared client (`public/admin/supabase.js`) at run time, so it uses the same session as the hub and the tracker. With no session it sends you to `/admin/login.html`.
- **Data:** `src/data/DataContext.jsx` is the swap point. By default it uses `adapters/supabase.js` (tables `outlay_expenses`, `outlay_subscriptions`, `outlay_clients`, private bucket `outlay-receipts`). `adapters/demo.js` is the sample-data dev fallback.
- **Theme:** every Studio color and font token lives under the `.outlay-root` wrapper (`src/directions/dial/theme.css`, dark mode in `.outlay-root[data-mode="dark"]`), so nothing leaks into another admin page.
- **Build:** `npm run build` here writes to `public/admin/outlay/` (gitignored). The root `npm run build` runs it before the site build, the same way as the tracker.

## Database setup (done, live)

`supabase/outlay.sql` created the three `outlay_` tables, owner-only row level security, and the private `outlay-receipts` bucket with matching storage policies. It is safe to run twice and has rollback notes at the top.

## Run it

```bash
npm install
npm run dev          # live: needs a session saved by /admin/login.html on the same origin
npm run dev:sample   # sample data kept in this browser, no Supabase calls
```

In dev, `vite.config.js` serves the site's `public/` admin files so the shared client and login page work on the same origin.

## Tax mapping

Categories map to the usual Schedule C lines for a single-member LLC in `src/lib/categories.js`, and business meals count at 50%. It is a starting point, not tax advice: confirm the final numbers with your tax preparer.
