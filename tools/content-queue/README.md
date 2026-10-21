# Content Queue for the DOC Admin Hub

Capture content ideas, draft posts and schedule them for Developer of Code and its clients.
Built with Vite, React 18 and Tailwind 3. Data is saved in the browser for now.

## What is in it

- **Capture an idea**: title, notes, tags and who it is for. Ctrl or Cmd + Enter adds it.
- **Next 14 days**: every scheduled post by day, so gaps in the schedule are easy to spot. Tap an empty day to start a post on it.
- **Board**: Idea, Drafting, Scheduled, Posted and Skipped. Drag with a mouse, or long press and drag on a phone or iPad. On smaller screens a status bar slides up while you drag, so you can drop without scrolling sideways.
- **List**: filters for who it is for, platform, status and tag, plus search and three sort orders.
- **Composer**: title, platform (Facebook, Instagram, LinkedIn, X, Google Business Profile, blog, email), post text, image link or upload, date and time, status, tags and notes. A counter under the text knows each platform's limit and where the feed folds the text. The live preview shows how the post reads on that platform.
- **Mark as posted**: saves the live link and the time it went out. Posted cards get a View live link.
- **Promote via email**: a placeholder that saves the post as a promotion with an audience (current clients, past clients, leads who opted in), ready for the Marketing tool.
- Undo on moves and deletes, a back to top button, keyboard focus states and reduced motion support.

Status is drawn as a shape so it reads without color: a dashed ring for Idea, half full for Drafting, an orange ring with a center for Scheduled, a solid disc with a check for Posted and a slashed ring for Skipped.

## Where it lives

Served at `/admin/content-queue/` behind the admin sign in, with a card on the Hub and an entry in
the DOC Admin Mac app. It uses the admin's shared Supabase client (`/admin/supabase.js`) only to
check the session. The root `npm run build` runs `build:content-queue`, which builds into
`public/admin/content-queue/` (gitignored), the same way as Marketing and the other tools.

```bash
npm install
npm run dev:open       # local design work, skips the sign in check
npm run build          # into ../../public/admin/content-queue
npm run images         # re-renders the sample post graphics (needs Playwright: npm i -D playwright)
```

## Businesses

Who a post is for. The list starts with `data/accounts.js` and is saved with the queue after that.
Add one from any "For" picker ("+ Add a business…") or from **Businesses** at the bottom of the
page, where you can also edit or remove them. Developer of Code cannot be removed. Removing a
business keeps its posts; they show as "Removed business" until you pick someone else.

## Move the data to Supabase later

`data/QueueContext.jsx` is the only file that touches storage (posts and businesses). Swap its load and save for table calls and nothing else changes. A table that matches the post shape:

```sql
create table content_posts (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users on delete cascade,
  title text not null default '',
  notes text not null default '',
  body text not null default '',
  platform text check (platform in ('facebook','instagram','linkedin','x','gbp','blog','email')),
  account text not null default 'doc',
  image_url text not null default '',
  scheduled_at timestamptz,
  status text not null default 'idea' check (status in ('idea','drafting','scheduled','posted','skipped')),
  tags text[] not null default '{}',
  live_url text not null default '',
  posted_at timestamptz,
  promo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table content_posts enable row level security;
create policy "owner reads and writes" on content_posts
  for all using (auth.uid() = owner) with check (auth.uid() = owner);
create index on content_posts (owner, status);
create index on content_posts (owner, scheduled_at);
```

Uploaded images are stored as small JPEG data inside the post for now. With Supabase, upload them to a Storage bucket and keep the public URL in `image_url`.

## Notes

- Character limits: Facebook 63,206, Instagram 2,200 (and 30 hashtags), LinkedIn 3,000, X 280 (links count as 23), Business Profile 1,500. Fold points are approximate, which the composer says.
- Email uses the title as the subject line and flags subjects over 60 characters. Blog and email show word count and reading time instead of a limit.
- Saving a post as Scheduled needs a platform, a date and text inside the limit. Posted needs a live link.
- The sample data is marked with `sample: true`. Use "Start empty" at the bottom of the page when you are ready for real content.
