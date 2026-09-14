-- Simple public PDF link on a lesson.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Then paste a storage URL into lessons.pdf_url, e.g.:
--   update public.lessons
--   set pdf_url = 'https://YOUR_PROJECT.supabase.co/storage/v1/object/public/course-pdfs/task-1.pdf'
--   where id = 'ch10-l3';

alter table public.lessons add column if not exists pdf_url text;

-- Thinkific PDF / download lessons were stored as type=upload. They are not student uploads.
update public.lessons
set requires_submission = false
where type = 'upload'
  and title !~* 'submission';
