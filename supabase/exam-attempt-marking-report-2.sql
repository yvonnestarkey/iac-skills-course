-- Second marking report PDF on an exam attempt (Zimbabwe students send two).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

alter table public.exam_attempts
  add column if not exists marking_report_2_path text,
  add column if not exists marking_report_2_url text,
  add column if not exists marking_report_2_name text;

comment on column public.exam_attempts.marking_report_2_name is
  'Optional second marking report PDF, used when a sitting has two mark reports.';
