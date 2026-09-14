-- Optional drip dates for lessons.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.lessons add column if not exists unlock_at timestamptz;
