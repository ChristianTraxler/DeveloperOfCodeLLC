# Mail (admin tool)

Served at `/admin/mail/` behind the admin login. Built by `npm run build:mail` (part of the main
`npm run build`) into `public/admin/mail/`, which is git-ignored like the other tools.

How it is wired in this repo:

- `src/app/` is the shell: sign-in gate on the shared `/admin/supabase.js` client, top bar, hash routes.
- `src/features/mail/` is the feature, copied as is from the original Mail project.
- The backend lives in the repo's `supabase/`: `functions/mail-*` and `functions/_shared`,
  `mail.sql` (tables, RLS, Realtime), `mail-cron.sql` (6-hourly watch renewal), `config.mail.toml`.
- `npm run check` here type-checks the Edge Functions, runs their tests and builds the app.
- Redeploy the functions with:
  `supabase functions deploy mail-api mail-auth mail-push mail-cron --no-verify-jwt --use-api --project-ref puidodfmebwqzbbtqjiu`

The original guide follows. Paths in it refer to the original standalone project.

---


Your business Gmail as a tool inside the Developer of Code Admin Hub. New mail shows up within
seconds of reaching Gmail, and everything you do in Mail (read, reply, archive, star, label,
trash) happens in Gmail too, and the other way around.

## Start here

| File | What it is |
| --- | --- |
| `doc-admin-mail-preview.html` | The whole preview in one file. Open it in any browser, no sign-in. It runs on an example inbox. |
| `doc-admin-mail-source.zip` | This project: the Mail feature, the four Edge Functions, the database migration, tests and this guide. |
| `doc-admin-mail-dist.zip` | A built copy of the preview for static hosting (Vercel, Netlify Drop). |

The preview opens on Mail. The **Hub** button shows the Admin Hub with the new Mail tile.
Every email in the preview is made up (all addresses end in `.example`). New ones keep arriving
while it is open, so you can see what live feels like. Reply to any of the people in it and an
answer comes back about 20 seconds later.

## What it does

- **Live inbox.** Gmail tells Google Pub/Sub about every change, Pub/Sub calls the `mail-push`
  function, and Supabase Realtime pushes the change to the open page. If Realtime drops, the page
  checks every 20 seconds until it reconnects.
- **Folders, labels and search.** Inbox, Starred, Sent, Drafts, All mail, Spam, Trash and your
  Gmail labels with unread counts. Search takes Gmail operators (`from:`, `to:`, `subject:`,
  `label:`, `has:attachment`, `is:unread`, `before:`, `after:`) and searches can be saved.
- **Reading.** Conversations read like a stack of letters: older messages fold down, quoted text
  collapses, attachments show as thumbnails. Remote images stay off until you allow them (per
  email or always for a sender), tracking pixels are always removed, and email HTML renders in a
  sandboxed frame with scripts off.
- **Writing.** New, reply, reply all and forward (attachments carried over), send-as addresses
  from Gmail, your signature, drafts that save to Gmail as you type, undo send (5 seconds by
  default), and Ctrl or Cmd + Enter to send.
- **Triage.** Archive, trash, read or unread, star and label from the reader, from row hover
  buttons, in bulk, by swiping rows on a phone, or with Gmail-style keyboard shortcuts (press `?`).
- **Hub tile.** Unread count and the newest sender, updated live.
- **Phone first.** Large list, full-screen reader with a thumb-reach action bar, compose sheet,
  folder sheet, swipe left to archive, swipe right for read or unread, long-press to select.

## How it fits together

```
Gmail ── watch ──▶ Pub/Sub topic ── push ──▶ mail-push  (checks MAIL_PUSH_TOKEN)
                                               │  history.list since the last history id
                                               ▼
                                     mail_events row in Postgres
                                               │  Supabase Realtime (owner only, RLS)
                                               ▼
                                     Mail page refreshes just the changed threads

Mail page ──▶ mail-api  ──▶ Gmail API   (read, send, drafts, labels, archive, trash)
Mail page ──▶ mail-auth ──▶ Google sign-in (link and unlink)
pg_cron every 6 hours ──▶ mail-cron: renews the Gmail watch, catches up, clears old events
```

**Security**

- Google's tokens are encrypted with AES-GCM (`MAIL_TOKEN_KEY`) before they reach the database,
  in a table the browser can never read (RLS on, no policies).
- Mail asks Google only for `gmail.modify`: read, send, label, archive and trash. It cannot
  permanently delete mail.
- `MAIL_ALLOWED_USERS` limits Mail to your admin login(s). `MAIL_APP_ORIGINS` limits which sites can
  call the functions and where Google may send you back after sign-in.
- The sign-in state is single use and expires in 15 minutes.

## Setup

Plan on about 30 minutes. You need the admin's Supabase project and a Google Cloud project.
Wherever you see `<ref>`, use your Supabase project ref (the part before `.supabase.co`).

### 1. Google Cloud

1. Open [console.cloud.google.com](https://console.cloud.google.com) and create a project (or use one you have).
2. **APIs & Services → Library:** enable **Gmail API** and **Cloud Pub/Sub API**.
3. **Google Auth Platform → Branding:** app name `DOC Admin Mail`, your support email, your developer email.
4. **Audience:** user type **External** (required for an @gmail.com account).
5. **Data Access → Add scopes:** add `https://www.googleapis.com/auth/gmail.modify`.
6. **Audience → Publish app**, so the status reads **In production**.
   - While an app is in Testing, Google ends the sign-in after 7 days and Mail would ask you to link
     Gmail again every week.
   - Because the app is not verified, Google shows a "Google hasn't verified this app" screen when you
     link. Choose **Advanced**, then **Go to DOC Admin Mail**. That is expected for a private tool.
     Unverified apps are capped at 100 users, which does not matter for one inbox.
7. **Clients → Create client → Web application.** Under **Authorized redirect URIs** add
   `https://<ref>.supabase.co/functions/v1/mail-auth` exactly. Copy the client ID and secret.
8. **Pub/Sub → Topics → Create topic** named `gmail-push`. Its full name is
   `projects/<gcp-project-id>/topics/gmail-push`.
9. On that topic, **Add principal** `gmail-api-push@system.gserviceaccount.com` with the role
   **Pub/Sub Publisher**. Without this, Gmail cannot announce changes.
10. On that topic, **Create subscription:** delivery type **Push**, endpoint
    `https://<ref>.supabase.co/functions/v1/mail-push?token=<MAIL_PUSH_TOKEN>` (the value you make in
    step 2.3), acknowledgement deadline 30 seconds, retry policy "exponential backoff".

### 2. Supabase

1. **Database.** Run `supabase/migrations/20261012120000_mail_tool.sql` (copy it into the admin's
   `supabase/migrations` and run `supabase db push`, or paste it into the SQL editor). It creates the
   four `mail_*` tables, row level security and the Realtime feed.
2. **Functions.** Copy `supabase/functions/_shared`, `mail-api`, `mail-auth`, `mail-push` and
   `mail-cron` into the admin's `supabase/functions`, and add the four blocks from
   `supabase/config.mail.toml` to `supabase/config.toml`.
3. **Secrets.** Make three random values, then set everything in one go:

   ```bash
   openssl rand -base64 32   # MAIL_TOKEN_KEY
   openssl rand -hex 24      # MAIL_PUSH_TOKEN
   openssl rand -hex 24      # MAIL_CRON_SECRET

   supabase secrets set \
     GOOGLE_CLIENT_ID="...apps.googleusercontent.com" \
     GOOGLE_CLIENT_SECRET="..." \
     MAIL_TOKEN_KEY="..." \
     MAIL_PUSH_TOKEN="..." \
     MAIL_CRON_SECRET="..." \
     MAIL_PUBSUB_TOPIC="projects/<gcp-project-id>/topics/gmail-push" \
     MAIL_APP_ORIGINS="https://<your-admin-domain>,http://localhost:5173" \
     MAIL_ALLOWED_USERS="<the email you sign in to the admin with>"
   ```

4. **Deploy.**

   ```bash
   supabase functions deploy mail-api mail-auth mail-push mail-cron --no-verify-jwt
   ```

   Each function checks who is calling in its own code (admin login, Pub/Sub token or cron
   secret), so the platform JWT check stays off for these four.
5. **Schedule.** Open `supabase/cron.sql`, replace the two placeholders (your project URL and the
   same `MAIL_CRON_SECRET`), and run it in the SQL editor. It uses `pg_cron`, `pg_net` and Vault to
   call `mail-cron` every 6 hours. Google stops sending changes if the watch is not renewed within
   7 days, so this job is what keeps Mail live.

**All settings**

| Secret | Required | What it is |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID from step 1.7 |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret from step 1.7 |
| `MAIL_TOKEN_KEY` | Yes | 32 random bytes in base64. Encrypts Google's tokens. Keep it; changing it means linking Gmail again. |
| `MAIL_APP_ORIGINS` | Yes | Comma-separated origins of the admin, like `https://admin.example.com` |
| `MAIL_PUSH_TOKEN` | For live updates | Shared secret in the Pub/Sub push URL |
| `MAIL_PUBSUB_TOPIC` | For live updates | Full topic name. Without it Mail still works and checks for changes every 20 seconds. |
| `MAIL_CRON_SECRET` | For live updates | Checked by `mail-cron` |
| `MAIL_ALLOWED_USERS` | Recommended | Comma-separated admin login emails allowed to use Mail. Empty means any signed-in user. |
| `MAIL_OAUTH_REDIRECT_URI` | No | Only if the redirect URI is not `https://<ref>.supabase.co/functions/v1/mail-auth` |
| `MAIL_SERVICE_KEY` | No | Only if you want to pick the database key yourself. By default the functions use the project's secret key. |

### 3. Add Mail to the admin

1. Copy `src/features/mail` into the admin at the same path.
2. Install what it uses (most of it the admin already has):

   ```bash
   npm i dompurify framer-motion lucide-react
   ```

3. Tailwind: make sure `content` covers `src/features/mail/**/*.{js,jsx}`. Mail uses the hub's
   color names (`ink`, `panel`, `raised`, `bone`, `mute`, `faint`, `ember`, `live`, `danger`, `line`,
   `line2`) and fonts (`font-display` Literata, `font-sans` Mona Sans). Add the three paper colors
   from this project's `tailwind.config.js`: `paper`, `ink2` and `slate`.
4. Add the route. Mail takes the part of the address after `mail/` and tells you when it changes:

   ```jsx
   import { MailTool, createGmailApi } from './features/mail'
   import { supabase } from './lib/supabase' // the admin's existing client

   const mailApi = createGmailApi({ supabase })

   // for #/mail and #/mail/<anything>
   <MailTool
     api={mailApi}
     path={subPath} // "" or "f/SENT" or "f/INBOX/t/18c2..."
     navigate={(next) => (window.location.hash = next ? `#/mail/${next}` : '#/mail')}
   />
   ```

5. Add the tile to the Hub page:

   ```jsx
   import { MailTileArt, mailTileMeta, useMailSummary } from './features/mail'

   const summary = useMailSummary(mailApi)
   // title "Mail", art={<MailTileArt summary={summary} />}, meta={mailTileMeta(summary, Date.now())}
   ```

6. If the admin's top bar is not 64px tall, set `--ml-top` on `:root` to its height so the desktop
   layout fills the screen exactly.

`src/preview` is only the stand-in hub for the preview. Don't copy it.

### 4. Link Gmail

1. Open Mail in the admin and choose **Link Gmail**.
2. Pick **DeveloperOfCodeLLC@Gmail.com**, then **Advanced → Go to DOC Admin Mail**, then **Allow**.
3. You land back in Mail with your inbox. The chip next to the title turns green and says **Live**
   when push updates are working.
4. Test it: send an email to yourself from your phone. It should appear within a few seconds.

## Troubleshooting

| What you see | What to check |
| --- | --- |
| Google says `redirect_uri_mismatch` | The redirect URI on the OAuth client must match `https://<ref>.supabase.co/functions/v1/mail-auth` exactly. |
| "is not in MAIL_APP_ORIGINS" | Add the admin's origin (scheme + host + port) to `MAIL_APP_ORIGINS`. |
| Mail asks to link again after a week | The OAuth app is still in Testing. Publish it (step 1.6) and link once more. |
| The chip says "Checking" instead of "Live" | `MAIL_PUBSUB_TOPIC` is missing, or Realtime is off for `mail_events`. Mail still works and checks every 20 seconds. |
| No live updates, chip is green | Check the push subscription endpoint and token, then `select * from mail_events order by id desc limit 5;` and the `mail-push` logs. |
| Live updates stop after about a week | The cron job isn't running. `select * from cron.job_run_details order by start_time desc limit 5;` |

## Working on it

```bash
npm install
npm run dev            # the preview with the example inbox, at http://localhost:5173
npm run check          # type-checks the Edge Functions, runs their tests, builds the app
npm run build:single   # the one-file preview, written to dist-single/index.html
```

The example inbox lives in `src/features/mail/demo` and `api/demoApi.js`. It has the same methods
as the real connection (`api/gmailApi.js`), so every screen works the same in both.

## Hand it to Claude Code

Open the admin project in Claude Code, put this folder next to it, and paste:

> Add the Mail tool from `../doc-mail` to this admin. Read `../doc-mail/README.md` first.
> Copy `src/features/mail` and the `supabase` pieces (migration, the four `mail-*` functions,
> `_shared`, the config blocks), add the `#/mail` route and the Mail tile to the Hub page as the
> README describes, and match how this admin already does routing, the Supabase client and
> Tailwind. Do not copy `src/preview`. Do not change any other tool. Before you edit anything,
> look through this project and show me a short plan with the files you will touch, then wait for
> my OK. After the change, run the build and tell me the Google and Supabase steps that are left
> for me.
