-- Read the Required: reading check and RTFQ / Buried Treasure practice drills.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query) and run once. Safe to re-run.
--
-- reading_checks      one row per reading check (pace vs absorption, no required)
-- reading_attempts    one row per practice exercise (the whole result, for the student and the coach)
-- reading_mark_calls  one row per automatic marking call: tokens and cost. Written only by the server
--                     (service role), so the daily limit and the spend figures cannot be tampered with.

create table if not exists public.reading_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  check_id text not null,
  wpm int not null default 0,
  read_sec int not null default 0,
  absorb int not null default 0,
  absorb_n int not null default 0,
  missed int[] not null default '{}',
  notes int not null default 0,
  profile text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.reading_mark_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  model text not null default '',
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  cost_usd numeric(10, 5) not null default 0,
  ok boolean not null default true,
  error text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.reading_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id text not null,
  wpm int not null default 0,
  read_sec int not null default 0,
  answer_sec int not null default 0,
  total_sec int not null default 0,
  recall int not null default 0,
  recall_n int not null default 0,
  rtfq_read jsonb not null default '{}'::jsonb,
  rtfq_delivered jsonb not null default '{}'::jsonb,
  buried_treasure jsonb not null default '{}'::jsonb,
  rows_earned text[] not null default '{}',
  notes jsonb not null default '[]'::jsonb,
  answer text not null default '',
  fix text not null default '',
  signals text[] not null default '{}',
  grade jsonb not null default '{}'::jsonb,
  marked_by text not null default 'self' check (marked_by in ('model', 'self')),
  mark_call_id uuid references public.reading_mark_calls (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists reading_checks_user_created_idx on public.reading_checks (user_id, created_at desc);
create index if not exists reading_attempts_user_created_idx on public.reading_attempts (user_id, created_at desc);
create index if not exists reading_mark_calls_user_created_idx on public.reading_mark_calls (user_id, created_at desc);

alter table public.reading_checks enable row level security;
alter table public.reading_attempts enable row level security;
alter table public.reading_mark_calls enable row level security;

-- Students read and add their own; course staff read everyone's.
drop policy if exists "students read own reading checks" on public.reading_checks;
create policy "students read own reading checks" on public.reading_checks for select to authenticated
  using (auth.uid() = user_id or public.is_course_staff());
drop policy if exists "students insert own reading checks" on public.reading_checks;
create policy "students insert own reading checks" on public.reading_checks for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "students read own reading attempts" on public.reading_attempts;
create policy "students read own reading attempts" on public.reading_attempts for select to authenticated
  using (auth.uid() = user_id or public.is_course_staff());
drop policy if exists "students insert own reading attempts" on public.reading_attempts;
create policy "students insert own reading attempts" on public.reading_attempts for insert to authenticated
  with check (auth.uid() = user_id);

-- Marking calls: written by the server only; staff can read them for spend.
drop policy if exists "staff read reading mark calls" on public.reading_mark_calls;
create policy "staff read reading mark calls" on public.reading_mark_calls for select to authenticated
  using (public.is_course_staff());

grant select, insert on public.reading_checks to authenticated;
grant select, insert on public.reading_attempts to authenticated;
grant select on public.reading_mark_calls to authenticated;
