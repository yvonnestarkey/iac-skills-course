-- Whole-exam script uploads: Paper 1 stays on marked_script_*.
-- Paper 2 and Paper 3 get their own columns.
-- Paste in the Supabase SQL editor.

alter table public.exam_attempts
  add column if not exists marked_script_p2_path text,
  add column if not exists marked_script_p2_url text,
  add column if not exists marked_script_p2_name text,
  add column if not exists marked_script_p3_path text,
  add column if not exists marked_script_p3_url text,
  add column if not exists marked_script_p3_name text;

comment on column public.exam_attempts.marked_script_p2_name is
  'Paper 2 exam script filename for a whole-sitting attempt.';

comment on column public.exam_attempts.marked_script_p3_name is
  'Paper 3 exam script filename for a whole-sitting attempt.';
