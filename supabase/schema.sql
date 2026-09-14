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

alter table public.lessons add column if not exists video_urls jsonb;
alter table public.lessons add column if not exists thinkific_url text;
alter table public.lessons add column if not exists video_duration_seconds integer;
alter table public.lessons add column if not exists estimated_read_minutes integer;
alter table public.lessons add column if not exists duration_minutes integer;

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

-- Chapter titles for the sidebar and dashboard (lessons.chapter_id → chapters.id).
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

drop policy if exists "progress readable by course users" on public.lesson_progress;
create policy "progress readable by course users"
  on public.lesson_progress for select
  to anon, authenticated
  using (true);

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

create index if not exists inbox_messages_student_id_idx
  on public.inbox_messages (student_id, created_at);

create index if not exists inbox_messages_created_idx
  on public.inbox_messages (created_at desc);

alter table public.inbox_messages enable row level security;

-- Inbox RLS is applied after public.profiles exists (see is_course_staff below).

-- Per-student study planner (start date, weekly hours, sessions).
create table if not exists public.study_plans (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  start_date  text not null,
  hours       numeric not null default 5,
  slots       jsonb not null default '[]'::jsonb,
  makeups     jsonb not null default '[]'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table public.study_plans enable row level security;

drop policy if exists "study plans are the student's own" on public.study_plans;
create policy "study plans are the student's own"
  on public.study_plans for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- One row per registered account so /coach can list live students.
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text not null,
  full_name    text,
  role         text not null default 'student' check (role in ('student', 'coach', 'admin')),
  cohort       text not null default 'autumn26',
  last_active  date,
  created_at   timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles (role);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by course users" on public.profiles;
create policy "profiles readable by course users"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "profiles writable by owner" on public.profiles;
create policy "profiles writable by owner"
  on public.profiles for all
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- New Auth users get a student profile automatically.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name)
  values (
    new.id,
    coalesce(new.email, ''),
    'student',
    split_part(coalesce(new.email, 'student'), '@', 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill anyone who already registered before this table existed.
insert into public.profiles (id, email, role, full_name)
select
  u.id,
  coalesce(u.email, ''),
  'student',
  split_part(coalesce(u.email, 'student'), '@', 1)
from auth.users u
on conflict (id) do nothing;

-- student_id is the owning Auth user. Students may only read and write their
-- own inbox rows. Course staff (coach/admin) can read and write every thread.
create or replace function public.is_course_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((auth.jwt() -> 'user_metadata' ->> 'role') in ('coach', 'admin'), false)
    or coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('coach', 'admin'), false)
    or exists (
      select 1 from public.profiles
      where id = auth.uid()
        and role in ('coach', 'admin')
    )
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'coach@accountingstudyadvice.com',
      'admin@accountingstudyadvice.com',
      'yvonne@accountingstudyadvice.com'
    );
$$;

revoke all on function public.is_course_staff() from public;
grant execute on function public.is_course_staff() to authenticated;

drop policy if exists "inbox readable by course users" on public.inbox_messages;
drop policy if exists "inbox writable by course users" on public.inbox_messages;
drop policy if exists "students read own inbox" on public.inbox_messages;
drop policy if exists "staff read inbox" on public.inbox_messages;
drop policy if exists "students insert own inbox" on public.inbox_messages;
drop policy if exists "staff insert inbox" on public.inbox_messages;

create policy "students read own inbox"
  on public.inbox_messages for select
  to authenticated
  using (auth.uid() = student_id);

create policy "staff read inbox"
  on public.inbox_messages for select
  to authenticated
  using (public.is_course_staff());

create policy "students insert own inbox"
  on public.inbox_messages for insert
  to authenticated
  with check (auth.uid() = student_id and from_role = 'student');

create policy "staff insert inbox"
  on public.inbox_messages for insert
  to authenticated
  with check (public.is_course_staff());

-- Per-student notifications for announcements and assignment feedback.
drop view if exists public.notifications;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  message     text not null,
  type        text not null check (type in ('announcement', 'assignment_feedback')),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "students read own notifications" on public.notifications;
create policy "students read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "students update own notifications" on public.notifications;
create policy "students update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "staff read notifications" on public.notifications;
create policy "staff read notifications"
  on public.notifications for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff insert notifications" on public.notifications;
create policy "staff insert notifications"
  on public.notifications for insert
  to authenticated
  with check (public.is_course_staff());

grant select, insert, update on public.notifications to authenticated;

alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;

-- Attach older email-only inbox rows to the matching Auth account.
update public.inbox_messages m
set student_id = p.id
from public.profiles p
where m.student_id is null
  and lower(m.student_email) = lower(p.email);

-- Calendar apps fetch without a user session. Token is the student's user id.
create or replace function public.calendar_plan(token text)
returns table (
  user_id uuid,
  start_date text,
  hours numeric,
  slots jsonb,
  makeups jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.start_date, p.hours, p.slots, p.makeups
  from public.study_plans p
  where p.user_id::text = token
  limit 1;
$$;

revoke all on function public.calendar_plan(text) from public;
grant execute on function public.calendar_plan(text) to anon, authenticated;

-- Private dashboard notes. No staff read path — coaches cannot see these.
create table if not exists public.student_notes (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  body        text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.student_notes enable row level security;

drop policy if exists "student notes are private" on public.student_notes;
create policy "student notes are private"
  on public.student_notes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
