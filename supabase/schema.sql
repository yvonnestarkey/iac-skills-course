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

-- Prototype policies: guests and signed-in students can read lessons.
-- The Content Manager still writes with the publishable key.
-- Before launch, restrict writes to an authenticated coach role.
drop policy if exists "lessons readable by anon" on public.lessons;
drop policy if exists "lessons readable by students and guests" on public.lessons;
create policy "lessons readable by students and guests"
  on public.lessons for select
  to anon, authenticated
  using (true);

drop policy if exists "lessons writable by anon" on public.lessons;
create policy "lessons writable by anon"
  on public.lessons for all
  to anon, authenticated
  using (true)
  with check (true);

-- Per-student completion and notes for the clean /student/[lessonId] player.
-- lesson_id is not a foreign key so notes still save when the player falls
-- back to the seeded course (the lessons table may be empty locally).
create table if not exists public.lesson_progress (
  user_id     uuid not null references auth.users (id) on delete cascade,
  lesson_id   text not null,
  completed   boolean not null default false,
  notes       text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

alter table public.lesson_progress enable row level security;

drop policy if exists "progress is the student's own" on public.lesson_progress;
create policy "progress is the student's own"
  on public.lesson_progress for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Student questions, coach replies, and assignment feedback for /student and /coach.
create table if not exists public.inbox_messages (
  id             uuid primary key default gen_random_uuid(),
  student_id     uuid,
  student_email  text not null,
  from_role      text not null check (from_role in ('student', 'coach')),
  kind           text not null check (kind in ('question', 'reply', 'feedback')),
  body           text not null,
  context        text,
  lesson_id      text,
  created_at     timestamptz not null default now()
);

create index if not exists inbox_messages_student_idx
  on public.inbox_messages (student_email, created_at);

create index if not exists inbox_messages_created_idx
  on public.inbox_messages (created_at desc);

alter table public.inbox_messages enable row level security;

-- Prototype: the coach panel still uses the publishable key, and a signed-in
-- student in the same browser also needs to read and write this table.
drop policy if exists "inbox readable by course users" on public.inbox_messages;
create policy "inbox readable by course users"
  on public.inbox_messages for select
  to anon, authenticated
  using (true);

drop policy if exists "inbox writable by course users" on public.inbox_messages;
create policy "inbox writable by course users"
  on public.inbox_messages for insert
  to anon, authenticated
  with check (true);
