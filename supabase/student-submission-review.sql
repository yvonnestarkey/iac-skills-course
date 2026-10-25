-- Coach review fields for lesson assignment uploads (Task 1, Task 2, …).
-- Paste into the Supabase SQL editor.

alter table public.student_submissions add column if not exists feedback text not null default '';
alter table public.student_submissions add column if not exists feedback_file_url text;
alter table public.student_submissions add column if not exists graded_by uuid;
alter table public.student_submissions add column if not exists graded_at timestamptz;
