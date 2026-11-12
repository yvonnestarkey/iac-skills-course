-- Coach dashboard to-do reminders, optionally linked to students.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: it only adds missing tables/policies.

create table if not exists public.coach_reminders (
  id uuid primary key default gen_random_uuid(),
  body text not null default '',
  due_on date,
  done boolean not null default false,
  student_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists coach_reminders_open_idx
  on public.coach_reminders (done, due_on, created_at desc);

alter table public.coach_reminders enable row level security;

drop policy if exists "staff manage coach reminders" on public.coach_reminders;
create policy "staff manage coach reminders"
  on public.coach_reminders for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.coach_reminders to authenticated;
