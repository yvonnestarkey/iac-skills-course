-- Allow authenticated coach accounts to INSERT into public.notifications.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run. Drops the old inbox view if it is still named notifications.

drop view if exists public.notifications;

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade,
  student_id     uuid references auth.users (id) on delete cascade,
  student_email  text,
  from_role      text not null default 'coach',
  kind           text,
  title          text,
  message        text,
  body           text,
  type           text,
  read           boolean not null default false,
  created_at     timestamptz not null default now()
);

alter table public.notifications add column if not exists student_id uuid;
alter table public.notifications add column if not exists student_email text;
alter table public.notifications add column if not exists from_role text;
alter table public.notifications add column if not exists kind text;
alter table public.notifications add column if not exists title text;
alter table public.notifications add column if not exists message text;
alter table public.notifications add column if not exists body text;
alter table public.notifications add column if not exists type text;
alter table public.notifications add column if not exists read boolean default false;

alter table public.notifications enable row level security;

drop policy if exists "students read own notifications" on public.notifications;
create policy "students read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id or auth.uid() = student_id);

drop policy if exists "students update own notifications" on public.notifications;
create policy "students update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id or auth.uid() = student_id)
  with check (auth.uid() = user_id or auth.uid() = student_id);

drop policy if exists "staff read notifications" on public.notifications;
drop policy if exists "staff insert notifications" on public.notifications;
drop policy if exists "authenticated coaches insert notifications" on public.notifications;

-- Coaches signed in with Auth (role or known staff email) can insert.
create policy "authenticated coaches insert notifications"
  on public.notifications for insert
  to authenticated
  with check (public.is_course_staff());

create policy "staff read notifications"
  on public.notifications for select
  to authenticated
  using (public.is_course_staff());

grant select, insert, update on public.notifications to authenticated;
