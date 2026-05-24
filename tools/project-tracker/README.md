# &lt;/DOC&gt; Project Tracker

A personal project tracker built for **Developer of Code, LLC** — Vite + React + Tailwind + Supabase, deployable to Vercel. Matches the dark navy + cyan aesthetic of [developerofcode.com](https://developerofcode.com).

## Features

- **Progress checklist** per project — check off tasks as you build
- **Dashboard stats** — active, completed, hours logged, overall % done across all projects
- **Tech stack tags** + multi-select filtering across the project list
- **Client vs personal** category split
- **GitHub repo + live URL** links per project
- **Time tracking** — log hours per session with notes
- **Notes/changelog timeline** with milestone, blocker, release, and note types
- **Hero image upload** per project via Supabase Storage
- **Search + filter** by category, status, and tech stack

## Local setup

### 1. Install

```bash
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com).
2. In the **SQL Editor**, paste and run the contents of [`supabase/schema.sql`](supabase/schema.sql). This creates all tables, the storage bucket for hero images, and RLS policies.
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` `public` key

### 3. Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJh...
```

### 4. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

Add the two env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the Vercel project settings. Re-deploy and you're live.

Or push to GitHub and import the repo into Vercel — it auto-detects Vite and builds correctly. The included `vercel.json` handles SPA routing.

## Schema overview

| Table          | Purpose                                          |
| -------------- | ------------------------------------------------ |
| `projects`     | Core project record (name, status, links, etc.)  |
| `tasks`        | Checklist items per project — the progress core  |
| `time_entries` | Hours logged per project with optional notes     |
| `notes`        | Changelog timeline (note / milestone / blocker / release) |

Storage bucket `project-images` holds hero images (public read).

## RLS note

The schema enables Row Level Security but grants `anon` full access — appropriate for a single-user tracker behind a non-public Vercel URL. If you ever make this multi-user, add Supabase Auth and replace the `using (true)` policies with `using (auth.uid() = user_id)` patterns.

## Tech stack

- **Vite 5** + **React 18** + **React Router 6**
- **Tailwind CSS 3** with the actual developerofcode.com palette pulled from the live stylesheet (`#060a13` deep navy / `#ff4500` orange-red accent)
- **Supabase** (Postgres + Storage)
- **lucide-react** icons
- **Syne** display + **DM Sans** body (matching the DOC site)

---

Built by Claude for Christian @ Developer of Code, LLC.
