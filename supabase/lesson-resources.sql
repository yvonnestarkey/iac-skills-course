-- Lesson download files, separate from student submissions.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.lessons add column if not exists resource_downloads jsonb not null default '[]'::jsonb;

-- Thinkific PDF / download lessons were stored as type=upload. They are not student uploads.
update public.lessons
set requires_submission = false
where type = 'upload'
  and title !~* 'submission';
