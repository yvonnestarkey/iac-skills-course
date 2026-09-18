-- Buried Treasure (case-study conversion) logs for script evaluation Tool 3.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.case_study_conversion_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paper_name text not null default '',
  tier1_available numeric not null default 36,
  tier1_earned numeric not null default 0,
  tier1_conversion numeric not null default 0,
  tier2_available numeric not null default 130,
  tier2_earned numeric not null default 0,
  tier2_conversion numeric not null default 0,
  tier3_available numeric not null default 194,
  tier3_earned numeric not null default 0,
  tier3_conversion numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists case_study_conversion_user_created_idx
  on public.case_study_conversion_logs (user_id, created_at desc);

alter table public.case_study_conversion_logs enable row level security;

drop policy if exists "students read own buried treasure" on public.case_study_conversion_logs;
create policy "students read own buried treasure"
  on public.case_study_conversion_logs for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "students insert own buried treasure" on public.case_study_conversion_logs;
create policy "students insert own buried treasure"
  on public.case_study_conversion_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.case_study_conversion_logs to authenticated;
