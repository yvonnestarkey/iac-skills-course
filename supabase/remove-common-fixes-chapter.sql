-- Remove the old Common Fixes chapter from the course.
-- Those videos now live in public.study_clinic.
-- Paste after you have confirmed Study Clinic has the videos.

delete from public.course_preview_lessons
where lesson_id like 'ch11-%';

delete from public.lessons
where chapter_id = 'ch11'
   or chapter_id in (
    select id from public.chapters
    where title ~* 'common[[:space:]]+(fixes|challenges)'
       or title ~* 'fixes for common'
  );

delete from public.chapters
where id = 'ch11'
   or title ~* 'common[[:space:]]+(fixes|challenges)'
   or title ~* 'fixes for common';
