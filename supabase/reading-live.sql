-- Live-session reading drills (/live/<exercise id>): an open link, no sign-in.
-- One row per automatic marking call, with the answer, so the daily limits hold and Yvonne can see
-- what a session wrote and what it cost. Written only by the server (service role); staff can read it.
-- Paste into the Supabase SQL editor once. Safe to run again.

create table if not exists public.reading_live_calls (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null,
  browser_hash text not null default '',
  address_hash text not null default '',
  model text not null default '',
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  ok boolean not null default true,
  error text not null default '',
  answer text not null default '',
  rows_earned text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists reading_live_calls_created_idx on public.reading_live_calls (created_at desc);
create index if not exists reading_live_calls_browser_idx on public.reading_live_calls (browser_hash, created_at desc);
create index if not exists reading_live_calls_address_idx on public.reading_live_calls (address_hash, created_at desc);

alter table public.reading_live_calls enable row level security;

drop policy if exists "staff read live calls" on public.reading_live_calls;
create policy "staff read live calls" on public.reading_live_calls
  for select using (public.is_course_staff());

-- One row per finished live-session attempt, saved under the email the student typed at the start.
-- user_id is filled when the student happened to be signed in; otherwise the coach page matches the
-- email to a course account, so attempts can be moved onto a profile later.
create table if not exists public.reading_live_attempts (
  id uuid primary key default gen_random_uuid(),
  exercise_id text not null,
  email text not null,
  user_id uuid references auth.users (id) on delete set null,
  browser_hash text not null default '',
  pct int not null default 0,
  pot_pct int not null default 0,
  marked_by text not null default 'self',
  live_call_id uuid references public.reading_live_calls (id) on delete set null,
  attempt jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reading_live_attempts_created_idx on public.reading_live_attempts (created_at desc);
create index if not exists reading_live_attempts_email_idx on public.reading_live_attempts (lower(email), created_at desc);

alter table public.reading_live_attempts enable row level security;

drop policy if exists "staff read live attempts" on public.reading_live_attempts;
create policy "staff read live attempts" on public.reading_live_attempts
  for select using (public.is_course_staff());
