-- Volume vs Accuracy diagnostic log for pre-exam practice.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Column mapping for a full-paper session (one insert per question, grouped by notes session id):
--   paper_name          = Paper code · Question Code · title
--   marks_available     = Total Marks (official capped section allocation)
--   questions_available = Total Marks (same value, for compatibility)
--   questions_completed = Points Wrote (0 for calculation/disclosure sections)
--   marks_earned        = Marks You Got
--   notes               = session:{id}|paper:{code}|q:{question}|calc:{0|1}
-- Ratios (computed in app, not stored):
--   Volume %     = Points Wrote / Total Marks  (N/A on calculation rows)
--   Accuracy %   = Marks You Got / Points Wrote (N/A on calculation rows)

create table if not exists public.volume_accuracy_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paper_name text not null default '',
  minutes_allowed numeric not null default 0,
  minutes_used numeric not null default 0,
  questions_available numeric not null default 0,
  questions_completed numeric not null default 0,
  marks_available numeric not null default 0,
  marks_earned numeric not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists volume_accuracy_user_created_idx
  on public.volume_accuracy_entries (user_id, created_at desc);

alter table public.volume_accuracy_entries enable row level security;

drop policy if exists "students read own volume accuracy" on public.volume_accuracy_entries;
create policy "students read own volume accuracy"
  on public.volume_accuracy_entries for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "students insert own volume accuracy" on public.volume_accuracy_entries;
create policy "students insert own volume accuracy"
  on public.volume_accuracy_entries for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.volume_accuracy_entries to authenticated;
