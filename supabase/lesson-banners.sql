-- Optional full-width header banner on a lesson.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.lessons add column if not exists banner_image_url text;
