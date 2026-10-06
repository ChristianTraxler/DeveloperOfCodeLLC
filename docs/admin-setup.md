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

## Passkeys (beta)

The admin login supports passkeys (Face ID, Touch ID, security keys) next to
the password, which stays as the fallback. Supabase's passkey API is in beta.

1. Supabase dashboard → **Authentication → Passkeys** → enable, then set:
   - **Display Name**: Developer of Code
   - **RP ID**: `developerofcode.com` (bare domain, no scheme or path).
     Changing it later invalidates every enrolled passkey.
   - **Origins**: `https://developerofcode.com` (add `https://www.developerofcode.com`
     if you use it).
2. Deploy, sign in with your password at `/admin/login.html`, click **Passkeys**
   in the header, then **Add a passkey**.
3. Sign out and use **Sign in with a passkey**.

Passkeys bind to the exact domain, so they cannot be tested on localhost or a
`.vercel.app` preview. Test on developerofcode.com. The admin pages load
supabase-js 2.117.2 from esm.sh (see `public/admin/supabase.js`).

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
npm run build            # builds the Tracker into public/admin/tracker/, then the site into dist/
npm run preview          # serves dist/ (the site plus /admin) locally
# visit http://localhost:4173/admin/login.html
```
