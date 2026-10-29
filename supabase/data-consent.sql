-- Students' data choices: Eve training and academic research (both opt-in).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query). Safe to run more than once.
-- null = not answered yet, true = yes, false = no. Changing an answer later is allowed at any time.

alter table public.student_profiles add column if not exists eve_training_consent boolean;
alter table public.student_profiles add column if not exists research_consent boolean;
alter table public.student_profiles add column if not exists research_review_before_publish boolean;
alter table public.student_profiles add column if not exists consent_updated_at timestamptz;
alter table public.student_profiles add column if not exists consent_updated_by text;

comment on column public.student_profiles.eve_training_consent is
  'Student agreed (true) or declined (false) that their anonymised work and feedback may train Eve. null = not answered.';
comment on column public.student_profiles.research_consent is
  'Student agreed (true) or declined (false) to academic research use of their de-identified work. null = not answered.';
comment on column public.student_profiles.consent_updated_by is
  'student, or coach:<email> when changed on the student''s request.';
