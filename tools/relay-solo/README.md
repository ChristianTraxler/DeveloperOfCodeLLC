# Relay Solo (admin tool)

Served at `/admin/relay-solo/` behind the admin login. Built by `npm run build:relay-solo` (part of
the main `npm run build`) into `public/admin/relay-solo/`, which is git-ignored like the other tools.

How it is wired in this repo:

- `src/app/` is the shell, the same one Mail uses: the sign-in gate on the shared
  `/admin/supabase.js` client, and the top bar with Hub and Sign out. It adds a New tab link.
- Below the bar, the page shows the live Relay Solo app (`https://relay-solo.vercel.app/`) in a
  frame. Relay Solo has its own Supabase project and its own sign-in, so it keeps running from its
  own deployment (repo `Relay-Solo-Active`). The first time, you sign in to Relay inside the frame.
- To point the tool at another deployment (for example a preview of a branch), build with
  `VITE_RELAY_SOLO_URL=https://… npm run build:relay-solo`, or set that variable in Vercel.
- The hub card is in `public/admin/index.html` (`data-tool="relay-solo"`), next to Mail.

Things that only work in Relay's own tab (use New tab for these): installing it as an app, and
turning on push notifications, because browsers don't allow those inside a frame.
