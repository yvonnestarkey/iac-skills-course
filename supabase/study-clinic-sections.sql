-- Study Clinic libraries. Paste into the Supabase SQL editor.
-- Adds a section column and files existing clips: FinMan to Financial Management,
-- everything else currently in the table to Study Advice.

alter table public.study_clinic
  add column if not exists section text not null default 'study-advice';

update public.study_clinic
set section = 'financial-management'
where id = 'ch11-l8'
   or title ~* 'finman|financial management';

update public.study_clinic
set section = 'study-advice'
where coalesce(section, '') = ''
   or section not in (
     'financial-reporting',
     'auditing',
     'financial-management',
     'taxation',
     'study-advice'
   );

notify pgrst, 'reload schema';
