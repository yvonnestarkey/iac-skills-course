-- 1-on-1 coaching page (global copy + per-student session deliverables).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.coaching_page_config (
  id text primary key default 'default',
  title text not null default '1-on-1 Coaching Session',
  description text not null default '',
  calendly_url text,
  banner_image_url text,
  updated_at timestamptz not null default now()
);

insert into public.coaching_page_config (id, title, description, calendly_url, banner_image_url)
values (
  'default',
  '1-on-1 Coaching Session',
  'Book a private session with Yvonne. After you meet, your Fireflies summary, recording, and coach notes will appear here.',
  null,
  null
)
on conflict (id) do nothing;

create table if not exists public.student_coaching_sessions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled')),
  session_at timestamptz,
  fireflies_pdf_url text,
  vimeo_recording_url text,
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
