-- Open every Phase 1 (S) lesson after registration.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

update public.lessons l
set prereq_lesson_id = null
from public.chapters c
where l.chapter_id = c.id
  and coalesce(c.position, 0) < (
    select coalesce(min(position), 2147483647)
    from public.chapters
    where title ~* '^Task '
  );
