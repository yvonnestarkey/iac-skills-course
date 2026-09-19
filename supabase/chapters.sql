-- Chapters table + extra lesson fields for the Thinkific seed.
-- Run this in the Supabase SQL editor before `npx tsx scripts/seed-supabase.ts`.

create table if not exists public.chapters (
  id          text primary key,
  title       text not null,
  summary     text not null default '',
  position    integer not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.chapters enable row level security;

drop policy if exists "chapters readable by students and guests" on public.chapters;
create policy "chapters readable by students and guests"
  on public.chapters for select
  to anon, authenticated
  using (true);

drop policy if exists "chapters writable by anon" on public.chapters;
create policy "chapters writable by anon"
  on public.chapters for all
  to anon, authenticated
  using (true)
  with check (true);

alter table public.lessons add column if not exists video_urls jsonb;
alter table public.lessons add column if not exists thinkific_url text;
alter table public.lessons add column if not exists video_duration_seconds integer;
alter table public.lessons add column if not exists estimated_read_minutes integer;
alter table public.lessons add column if not exists duration_minutes integer;
