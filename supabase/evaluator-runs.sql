-- Script Evaluator v2: stores each evaluation run (dataset + report) separately from exam_attempts.
-- Paste into the Supabase SQL editor. Adds a new table only; changes nothing existing.
-- Runs are immutable: calibration reruns create new rows so results can be compared over time.

create table if not exists public.evaluator_runs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  kind text not null default 'calibration' check (kind in ('calibration', 'student')),
  model text not null,
  dataset jsonb not null,
  report jsonb,
  usage jsonb,
  coach_review jsonb,           -- Keep / Edit / Remove / Wrong-diagnosis labels from Yvonne
  created_at timestamptz not null default now()
);

create index if not exists evaluator_runs_attempt_idx on public.evaluator_runs (attempt_id, created_at desc);

alter table public.evaluator_runs enable row level security;

-- Staff can read all; students read only the report-bearing runs of their own attempts (report visibility is gated in the app).
drop policy if exists "staff read evaluator runs" on public.evaluator_runs;
create policy "staff read evaluator runs"
  on public.evaluator_runs for select
  to authenticated
  using (public.is_course_staff());

grant select on public.evaluator_runs to authenticated;
-- Inserts happen server-side with the service role only.
