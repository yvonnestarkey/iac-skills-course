-- Fireflies 1-on-1 coaching import (API key + webhook + session transcript/summary).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.fireflies_settings (
  id integer primary key default 1,
  api_key text,
  webhook_secret text,
  updated_at timestamptz not null default now()
);

insert into public.fireflies_settings (id)
values (1)
on conflict (id) do nothing;

create table if not exists public.fireflies_imports (
  id uuid primary key default gen_random_uuid(),
  meeting_id text not null,
  event text,
  title text,
  student_id uuid references auth.users (id) on delete set null,
  status text not null default 'imported' check (status in ('imported', 'unmatched', 'skipped', 'error')),
  attendee_emails text[] not null default '{}',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists fireflies_imports_created_idx
  on public.fireflies_imports (created_at desc);

alter table public.student_coaching_sessions add column if not exists title text;
alter table public.student_coaching_sessions add column if not exists fireflies_meeting_id text;
alter table public.student_coaching_sessions add column if not exists fireflies_transcript_url text;
alter table public.student_coaching_sessions add column if not exists summary_text text;
alter table public.student_coaching_sessions add column if not exists transcript_text text;

create unique index if not exists student_coaching_sessions_fireflies_meeting_idx
  on public.student_coaching_sessions (fireflies_meeting_id)
  where fireflies_meeting_id is not null;

alter table public.fireflies_settings enable row level security;
alter table public.fireflies_imports enable row level security;

drop policy if exists "staff manage fireflies settings" on public.fireflies_settings;
create policy "staff manage fireflies settings"
  on public.fireflies_settings for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "staff read fireflies imports" on public.fireflies_imports;
create policy "staff read fireflies imports"
  on public.fireflies_imports for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.fireflies_settings to authenticated;
grant select, insert, update, delete on public.fireflies_imports to authenticated;
grant select, insert, update, delete on public.student_coaching_sessions to authenticated;
