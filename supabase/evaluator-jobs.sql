-- Script Evaluator v2 for students: background jobs, an on/off switch and the release (review) step.
-- Paste the whole file into the Supabase SQL editor and click Run. It adds two new tables and two new columns on
-- exam_attempts. It changes no existing data. Safe to run more than once.

-- One job per paper of a submitted attempt. The site works through each job one small step at a time
-- (Stage 0, then one question at a time, then the report data), saving progress after every step.
create table if not exists public.evaluator_jobs (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts (id) on delete cascade,
  paper_id text not null,
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  step text not null default 'stage0' check (step in ('stage0', 'requirements', 'assemble', 'done')),
  progress jsonb not null default '{}'::jsonb,
  failures integer not null default 0,
  last_error text,
  locked_until timestamptz,
  worker_token text not null,
  origin text,
  run_id uuid references public.evaluator_runs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (attempt_id, paper_id)
);

create index if not exists evaluator_jobs_status_idx on public.evaluator_jobs (status, updated_at desc);

alter table public.evaluator_jobs enable row level security;
drop policy if exists "staff read evaluator jobs" on public.evaluator_jobs;
create policy "staff read evaluator jobs"
  on public.evaluator_jobs for select
  to authenticated
  using (public.is_course_staff());
grant select on public.evaluator_jobs to authenticated;
-- Writes happen server-side with the service role only.

-- The switch. off = nobody uses the new evaluator; staff = only staff test attempts; all = every student.
create table if not exists public.evaluator_settings (
  id integer primary key default 1 check (id = 1),
  mode text not null default 'staff' check (mode in ('off', 'staff', 'all')),
  updated_at timestamptz not null default now()
);
insert into public.evaluator_settings (id) values (1) on conflict (id) do nothing;
alter table public.evaluator_settings enable row level security;
drop policy if exists "staff read evaluator settings" on public.evaluator_settings;
create policy "staff read evaluator settings"
  on public.evaluator_settings for select
  to authenticated
  using (public.is_course_staff());
grant select on public.evaluator_settings to authenticated;

-- The review step: a student sees the report only once Yvonne has released it.
alter table public.exam_attempts
  add column if not exists evaluator_report_released_at timestamptz,
  add column if not exists evaluator_report_released_by uuid;
