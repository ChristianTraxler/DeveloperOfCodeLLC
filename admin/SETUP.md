# Admin Hub — Setup Checklist

The code is built. To go live you need a Supabase project and ~6 dashboard
steps. None of this requires touching the code except pasting two values.

## 1. Create the Supabase project

In the Supabase dashboard (under your Developer Of Code account), create a new
project. Then go to **Project Settings → API** and copy:

- **Project URL** — `https://xxxxxxxx.supabase.co`
- **anon public key** — the long key labeled `anon` / `public`
  (this is safe to expose in the browser; RLS is the guard)

## 2. Plug those two values into two places

Same two values, both spots:

**a) `admin/supabase.js`** — replace the placeholders:

```js
export const SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGc...your-anon-key...';
```

**b) Vercel env vars** (the Tracker reads these at build time). Either in the
Vercel dashboard (Project → Settings → Environment Variables) or via CLI:

```bash
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
```

For **local** Tracker dev, also create `tools/project-tracker/.env.local`:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...your-anon-key...
```

## 3. Create the database

In **SQL Editor**, run, in order:

1. `tools/project-tracker/supabase/schema.sql` — tables, triggers, image bucket
   (skip if this project already has the Tracker tables).
2. `tools/project-tracker/supabase/policies-auth.sql` — swaps the open `anon`
   policies for **authenticated-only** ones. This is what actually locks the
   data behind login.

## 4. Create your admin user

**Authentication → Users → Add user** → your email + a password.
That is your login. There is no public signup.

## 5. Turn off public signups

**Authentication → Providers → Email** → disable
**"Allow new users to sign up."** Now only users you create can exist.

## 6. Set the Site URL

**Authentication → URL Configuration → Site URL** → `https://developerofcode.com`
(so any password-reset emails link back correctly).

---

## How it fits together

- `developerofcode.com/admin/login.html` — sign in.
- `developerofcode.com/admin/` — the hub (tool cards).
- `developerofcode.com/admin/tracker/` — the Projects Tracker (built by Vercel
  from `tools/project-tracker/` on every deploy).

One origin → one Supabase session → sign in once, everything unlocks.

## Security notes

- The lock is **Row Level Security**, not the redirects. After step 3, any
  query without a valid session is rejected by the database, even if someone
  reaches `/admin/tracker/` directly.
- The `anon` key in `admin/supabase.js` is **meant** to be public.
- Project **hero images** stay publicly readable by exact URL (so they render in
  `<img>` tags). Everything else — projects, tasks, time, notes — is
  authenticated-only. If you ever store anything sensitive as a hero image,
  switch the bucket to private + signed URLs.

## Local preview of the whole thing

```bash
npm run build            # builds the Tracker into admin/tracker/
npx serve .              # or any static server at the repo root
# visit http://localhost:3000/admin/login.html
```
