-- ============================================================
-- TEAM ALUM — ADMIN DASHBOARD v2 SCHEMA
-- Run this in the Supabase SQL editor ONCE.
-- ============================================================

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

create policy "Profiles are readable by authenticated users"
on public.profiles for select to authenticated
using (true);

-- First-time sign-in can self-provision a viewer profile
create policy "Users can create their own profile"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

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
-- AUTO-CREATE A PROFILE WHEN A USER SIGNS IN
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

-- After creating this, promote the FIRST user to owner:
--   update public.profiles set role = 'owner' where email = 'you@example.com';

-- ============================================================
-- 2. QUESTIONS (extended for the answers workflow)
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

create policy "Anyone can insert a question"
on public.questions for insert to anon, authenticated
with check (true);

create policy "Authenticated users can read questions"
on public.questions for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid()
));

create policy "Owners and editors can update questions"
on public.questions for update to authenticated
using (exists (
  select 1 from public.profiles p
  where p.id = auth.uid() and p.role in ('owner', 'editor')
));

-- ============================================================
-- 3. PAGE_VIEWS (lightweight visitor tracking)
-- ============================================================
create table if not exists public.page_views (
  id bigint generated always as identity primary key,
  page text not null,
  visitor_id uuid,
  referrer text,
  created_at timestamptz not null default now()
);

alter table public.page_views enable row level security;

create policy "Anyone can record a page view"
on public.page_views for insert to anon, authenticated
with check (true);

create policy "Staff can read page views"
on public.page_views for select to authenticated
using (exists (
  select 1 from public.profiles p where p.id = auth.uid()
));

-- ============================================================
-- 4. CONTENT_VIEWS (scaffold for Content section)
-- ============================================================
create table if not exists public.content_views (
  id bigint generated always as identity primary key,
  content_id text,
  content_type text,
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

-- security_invoker keeps the invoking role's RLS on the underlying tables
create or replace view public.question_stats
with (security_invoker = true) as
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

create or replace view public.daily_visits
with (security_invoker = true) as
select
  (created_at at time zone 'utc')::date as day,
  count(*)                              as visits
from public.page_views
group by day
order by day;

create or replace view public.visits_this_week
with (security_invoker = true) as
select count(*) as visits
from public.page_views
where created_at >= date_trunc('week', now()) - interval '7 days';

-- Grant PostgREST access to the views
grant select on public.question_stats      to authenticated;
grant select on public.daily_visits        to authenticated;
grant select on public.visits_this_week    to authenticated;
