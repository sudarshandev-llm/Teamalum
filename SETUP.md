# Team Alum — Setup & Deployment Guide

> **Admin dashboard v2** — role-based access (owner / editor / viewer), questions
> workflow with inline replies, and live analytics. Keep the existing stack
> (Supabase + static HTML/JS on Vercel) and Google sign-in as the entry point.

## QUICK START (5 minutes)

### Step 1: Create Supabase Project
1. Go to https://supabase.com → Sign in → Create a new project
2. Project name: `team-alum`
3. Set a database password (save it)
4. Choose the region closest to your users
5. Wait for the project to be created (~30 seconds)

### Step 2: Get Your Keys
1. In your Supabase dashboard → Project Settings → API
2. Copy **Project URL** (looks like: `https://xxxxxxxx.supabase.co`)
3. Copy **anon public** key (looks like: `eyJhbG...`)

### Step 3: Paste Keys Into Your Code
Open `supabase-config.js` and replace:
```js
export const supabase = createClient(
  'YOUR_SUPABASE_PROJECT_URL',   // ← paste Project URL here
  'YOUR_SUPABASE_ANON_KEY'        // ← paste anon key here
);
```

### Step 4: Create the Database Schema
Open Supabase dashboard → SQL Editor → run the SQL in `schema.sql` (reproduced
below). This creates all tables, RLS policies, and views the dashboard needs.

---

## DATABASE SCHEMA (`schema.sql`)

Run this in the Supabase SQL editor **once**.

```sql
-- ============================================================
-- 1. PROFILES (role-based access)
--    role: 'owner' | 'editor' | 'viewer'
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role text not null default 'viewer' check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Anyone signed in can read the profiles list (needed for the Team page)
create policy "Profiles are readable by authenticated users"
on public.profiles for select to authenticated
using (true);

-- First-time sign-in can self-provision a viewer profile
create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

-- Only the user themselves or an owner can update a profile
create policy "Users can update their own profile"
on public.profiles for update to authenticated
using (auth.uid() = id);

create policy "Owners can update any profile"
on public.profiles for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role = 'owner'
));

-- ---------------------------------------------------------------------------
-- AUTO-CREATE A PROFILE WHEN A USER SIGNS IN (via trigger)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'viewer')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- After creating this, add the FIRST owner manually:
--   insert into public.profiles (id, email, role)
--   select id, email, 'owner' from auth.users where email = 'you@example.com';

-- ============================================================
-- 2. QUESTIONS  (existing table, extended for the workflow)
-- ============================================================
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  question text not null,
  answer text,
  answered boolean not null default false,
  answered_by uuid references auth.users(id),
  answered_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.questions enable row level security;

-- Anyone (incl. anonymous visitors) can submit a question
create policy "Anyone can insert a question"
on public.questions for insert to anon, authenticated
with check (true);

-- Any signed-in profile (owner/editor/viewer) can read questions
create policy "Authenticated users can read questions"
on public.questions for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid()
));

-- Owners and editors can answer questions
create policy "Owners and editors can update questions"
on public.questions for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role in ('owner', 'editor')
));

-- ============================================================
-- 3. PAGE_VIEWS  (lightweight visitor tracking)
-- ============================================================
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  page text not null,
  visitor_id uuid,
  referrer text,
  created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

-- Public visitors can record a page view (no read access)
create policy "Anyone can record a page view"
on public.page_views for insert to anon, authenticated
with check (true);

-- Only authenticated staff can read page views / analytics
create policy "Staff can read page views"
on public.page_views for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid()
));

-- ============================================================
-- 4. CONTENT_VIEWS  (scaffold for Content section analytics)
-- ============================================================
create table if not exists public.content_views (
  id bigint generated always as identity primary key,
  content_id text,
  content_type text,   -- 'portfolio' | 'ebook' | 'study-pdf'
  visitor_id uuid,
  created_at timestamptz not null default now()
);

alter table public.content_views enable row level security;

create policy "Anyone can record a content view"
on public.content_views for insert to anon, authenticated
with check (true);

create policy "Staff can read content views"
on public.content_views for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid()
));

-- ============================================================
-- 5. VIEWS (analytics)
-- ============================================================

-- Question stats: counts by status + average response time (hours)
create or replace view public.question_stats as
select
  count(*) filter (where not answered)          as open_count,
  count(*) filter (where answered)              as answered_count,
  count(*)                                      as total_count,
  round(avg(
    case when answered_at is not null
    then extract(epoch from (answered_at - created_at)) / 3600.0
    end
  )::numeric, 2)                                as avg_response_hours
from public.questions;

-- Daily visits grouped by day
create or replace view public.daily_visits as
select
  (created_at at time zone 'utc')::date as day,
  count(*)                              as visits
from public.page_views
group by day
order by day;

-- Visitors this week (helper view)
create or replace view public.visits_this_week as
select count(*) as visits
from public.page_views
where created_at >= date_trunc('week', now()) - interval '7 days';
```

> **Note on views + RLS:** Postgres views created by the table owner bypass RLS
> for that owner. To let your Supabase role use them safely through PostgREST,
> grant select:
> ```sql
> grant select on public.question_stats to authenticated;
> grant select on public.daily_visits   to authenticated;
> grant select on public.visits_this_week to authenticated;
> ```

### Step 5: Enable Google OAuth (for admin login)
1. Go to https://console.cloud.google.com → create a project (`team-alum-auth`)
2. APIs & Services → Credentials → Create Credentials → OAuth client ID
3. Application type: **Web application**
4. Under **Authorized redirect URIs**, paste:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   ```
5. Copy the **Client ID** and **Client Secret**
6. In Supabase: Authentication → Providers → Google → enable, paste credentials
7. Authentication → URL Configuration:
   - Site URL: `https://your-deployed-domain.com`
   - Redirect URLs: `https://your-deployed-domain.com/admin.html`

### Step 6: Assign your first deputy
After signing in once with Google (a profile is auto-created with `viewer`),
promote yourself to owner in the SQL editor:
```sql
update public.profiles set role = 'owner' where email = 'your-email@gmail.com';
```

---

## DEPLOYMENT

### Option A: Vercel (Recommended — Free)
1. Push your code to GitHub, then import the repo in Vercel and click Deploy.
2. Site live at `https://team-alum.vercel.app`

The shared `supabase-config.js` is served with `Cache-Control: no-cache` so key
changes propagate (already configured in `vercel.json`).

### SEO / Exposure (already handled in this repo)
- `robots.txt` disallows `/admin.html` and `/admin`.
- `/admin.html` is **not** linked from the public nav and is **not** in
  `sitemap.xml`.

---

## FILE STRUCTURE
```
team-alum/
├── index.html          # Main site (6 pages)
├── style.css           # Public site styles
├── script.js           # Public site JS (incl. page_views tracking)
├── admin.html          # Admin dashboard shell (sidebar + auth gate)
├── admin/
│   ├── admin.js        # Auth, routing, nav, role gate, bootstrapping
│   ├── admin-questions.js
│   ├── admin-analytics.js
│   ├── admin-content.js
│   ├── admin-team.js
│   └── admin-settings.js
├── supabase-config.js  # Supabase credentials + shared helpers
├── schema.sql          # Full DB schema (run in Supabase SQL editor)
├── robots.txt          # Disallows /admin.html
├── sitemap.xml         # Public pages only
├── vercel.json
├── _redirects
└── SETUP.md            # This file
```

## LOCAL TESTING
```bash
python -m http.server 3000
# or
npx serve .
```
Then open `http://localhost:3000` and `http://localhost:3000/admin.html`.
