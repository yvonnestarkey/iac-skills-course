-- Optional coach-written Script Evaluation PDF. Paste in the Supabase SQL editor.
-- Safe to run more than once. Does not change existing reports or student uploads.

alter table public.exam_attempts
  add column if not exists coach_report_path text,
  add column if not exists coach_report_url text,
  add column if not exists coach_report_name text,
  add column if not exists coach_report_uploaded_at timestamptz,
  add column if not exists coach_report_uploaded_by uuid;

comment on column public.exam_attempts.coach_report_url is
  'Coach-uploaded Script Evaluation PDF. When set, this is what is released to the student instead of the system report.';
