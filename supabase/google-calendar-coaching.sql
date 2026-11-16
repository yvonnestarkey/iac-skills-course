-- Google Calendar 1-on-1 import (OAuth + webhook + scheduled session on the student profile).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

create table if not exists public.google_calendar_settings (
  id integer primary key default 1,
  google_email text,
  refresh_token text,
  access_token text,
  access_token_expires_at timestamptz,
  sync_token text,
  last_sync_at timestamptz,
  channel_id text,
  resource_id text,
  channel_expiration timestamptz,
  oauth_state text,
  updated_at timestamptz not null default now()
);

insert into public.google_calendar_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.google_calendar_imports (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  title text,
  student_id uuid references auth.users (id) on delete set null,
  status text not null default 'imported' check (status in ('imported', 'unmatched', 'skipped', 'error', 'cancelled')),
  attendee_emails text[] not null default '{}',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists google_calendar_imports_created_idx
  on public.google_calendar_imports (created_at desc);

alter table public.student_coaching_sessions add column if not exists google_event_id text;
alter table public.student_coaching_sessions add column if not exists meeting_url text;

create unique index if not exists student_coaching_sessions_google_event_idx
  on public.student_coaching_sessions (google_event_id)
  where google_event_id is not null;

alter table public.google_calendar_settings enable row level security;
alter table public.google_calendar_imports enable row level security;

drop policy if exists "staff manage google calendar settings" on public.google_calendar_settings;
create policy "staff manage google calendar settings"
  on public.google_calendar_settings for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "staff read google calendar imports" on public.google_calendar_imports;
create policy "staff read google calendar imports"
  on public.google_calendar_imports for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.google_calendar_settings to authenticated;
grant select, insert, update, delete on public.google_calendar_imports to authenticated;
grant select, insert, update, delete on public.student_coaching_sessions to authenticated;
