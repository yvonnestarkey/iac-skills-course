-- Course content for the IAC Skills Course.
-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.lessons (
  id          text primary key,
  chapter_id  text not null,
  position    integer not null default 0,
  type        text not null check (type in ('video', 'reading', 'assignment', 'upload', 'ask', 'survey')),
  title       text not null,
  duration    text,
  seconds     integer,
  blurb       text,
  body        jsonb,
  takeaways   jsonb,
  due         text,
  brief       text,
  created_at  timestamptz not null default now()
);

create index if not exists lessons_chapter_position_idx
  on public.lessons (chapter_id, position);

alter table public.lessons enable row level security;

-- Prototype policies: the portal has no sign-in yet, so the publishable
-- (anon) key needs to read and write content directly.
-- Before launch, restrict writes to an authenticated coach role.
drop policy if exists "lessons readable by anon" on public.lessons;
create policy "lessons readable by anon"
  on public.lessons for select
  to anon
  using (true);

drop policy if exists "lessons writable by anon" on public.lessons;
create policy "lessons writable by anon"
  on public.lessons for all
  to anon
  using (true)
  with check (true);
