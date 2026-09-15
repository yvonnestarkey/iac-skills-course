-- 1-on-1 coaching page (global copy + per-student session deliverables).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.coaching_page_config (
  id integer primary key default 1,
  title text not null default '1-on-1 Coaching Session',
  description text not null default '',
  calendly_url text not null,
  banner_image_url text,
  updated_at timestamptz not null default now()
);

insert into public.coaching_page_config (id, title, description, calendly_url, banner_image_url)
values (
  1,
  '1-on-1 Coaching Session',
  'Book a private session with Yvonne. After you meet, your Fireflies summary, recording, and coach notes will appear here.',
  'https://calendly.com',
  null
)
on conflict (id) do nothing;

alter table public.coaching_page_config add column if not exists dashboard_banner_url text;
alter table public.coaching_page_config add column if not exists recording_section_title text;
alter table public.coaching_page_config add column if not exists recording_section_description text;
alter table public.coaching_page_config add column if not exists recording_button_label text;
alter table public.coaching_page_config add column if not exists pdf_button_label text;

alter table public.student_coaching_sessions add column if not exists recording_url text;
alter table public.student_coaching_sessions add column if not exists pdf_summary_url text;

create table if not exists public.student_coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  session_at timestamptz,
  fireflies_pdf_url text,
  vimeo_recording_url text,
  recording_url text,
  pdf_summary_url text,
  coach_notes text,
  deliverables_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_coaching_sessions_student_idx
  on public.student_coaching_sessions (student_id, session_at desc);

alter table public.coaching_page_config enable row level security;
alter table public.student_coaching_sessions enable row level security;

drop policy if exists "students read coaching page config" on public.coaching_page_config;
create policy "students read coaching page config"
  on public.coaching_page_config for select
  to authenticated
  using (true);

drop policy if exists "staff write coaching page config" on public.coaching_page_config;
create policy "staff write coaching page config"
  on public.coaching_page_config for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "students read own coaching sessions" on public.student_coaching_sessions;
create policy "students read own coaching sessions"
  on public.student_coaching_sessions for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "students update own coaching sessions" on public.student_coaching_sessions;
create policy "students update own coaching sessions"
  on public.student_coaching_sessions for update
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "staff manage coaching sessions" on public.student_coaching_sessions;
create policy "staff manage coaching sessions"
  on public.student_coaching_sessions for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select on public.coaching_page_config to authenticated;
grant select, update on public.student_coaching_sessions to authenticated;
grant select, insert, update, delete on public.coaching_page_config to authenticated;
grant select, insert, update, delete on public.student_coaching_sessions to authenticated;

-- Live group sessions (Zoom + recordings + PDFs).
alter table public.coaching_page_config add column if not exists live_calendar_ics_url text;

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  session_at timestamptz not null,
  status text not null default 'upcoming' check (status in ('upcoming', 'completed', 'cancelled')),
  zoom_url text,
  recording_url text,
  summary_pdf_url text,
  notes_pdf_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists live_sessions_session_at_idx
  on public.live_sessions (session_at asc);

alter table public.live_sessions enable row level security;

drop policy if exists "students read live sessions" on public.live_sessions;
create policy "students read live sessions"
  on public.live_sessions for select
  to authenticated
  using (true);

drop policy if exists "staff manage live sessions" on public.live_sessions;
create policy "staff manage live sessions"
  on public.live_sessions for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select on public.live_sessions to authenticated;
grant select, insert, update, delete on public.live_sessions to authenticated;
