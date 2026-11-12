-- Dashboard banner announcements and login slide-ins.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: it only adds missing tables/policies.

create table if not exists public.dashboard_posts (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('announcement', 'slide')),
  title text not null default '',
  body text not null default '',
  video_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists dashboard_posts_live_idx
  on public.dashboard_posts (kind, status, published_at desc);

create unique index if not exists dashboard_posts_one_live_idx
  on public.dashboard_posts (kind)
  where status = 'published';

alter table public.dashboard_posts enable row level security;

drop policy if exists "students read published dashboard posts" on public.dashboard_posts;
create policy "students read published dashboard posts"
  on public.dashboard_posts for select
  to authenticated
  using (status = 'published');

drop policy if exists "staff manage dashboard posts" on public.dashboard_posts;
create policy "staff manage dashboard posts"
  on public.dashboard_posts for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.dashboard_posts to authenticated;
