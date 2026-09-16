-- Switch the live student cohort default from the old Autumn 2026 test value.
-- Paste in the Supabase SQL editor.

alter table public.profiles
  alter column cohort set default 'jan27';

update public.profiles
  set cohort = 'jan27'
  where cohort in ('autumn26', 'Autumn 2026', 'autumn', '');

update public.profiles
  set cohort = 'jun27'
  where cohort in ('summer26', 'Summer 2026', 'summer');
