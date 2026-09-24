-- Distinguish coach/test Script Evaluator attempts from genuine student attempts.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- Does not email anyone. Does not rewrite historical student rows.

alter table public.exam_attempts add column if not exists source text;

update public.exam_attempts
set source = 'student'
where source is null;

alter table public.exam_attempts drop constraint if exists exam_attempts_source_check;
alter table public.exam_attempts add constraint exam_attempts_source_check
  check (source is null or source in ('student', 'staff_test'));

create index if not exists exam_attempts_source_created_idx
  on public.exam_attempts (source, created_at desc);
