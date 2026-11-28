-- Allow Resubmit on lesson assignment uploads (Task PDFs).
-- Paste into the Supabase SQL editor.

alter table public.student_submissions drop constraint if exists student_submissions_status_check;
alter table public.student_submissions
  add constraint student_submissions_status_check
  check (status in ('submitted', 'approved', 'rejected', 'resubmit'));
