-- Run AFTER study-clinic.sql and after you have checked Table Editor → study_clinic.
-- Removes the copied Common Fixes videos from public.lessons so they only live in Study Clinic.

delete from public.lessons
where type = 'video'
  and (
    chapter_id = 'ch11'
    or chapter_id in (
      select id from public.chapters
      where title ~* 'common[[:space:]]+(fixes|challenges)'
         or title ~* 'fixes for common'
    )
  );
