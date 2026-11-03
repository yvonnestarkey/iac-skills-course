-- Store the actual notes from the Reading check, not only the count.
-- Paste into the Supabase SQL editor and run once. Safe to re-run.

alter table public.reading_checks
  add column if not exists notes_detail jsonb not null default '[]'::jsonb;
