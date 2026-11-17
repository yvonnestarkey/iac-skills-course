-- After Yvonne marks a journal need as contacted, clear that need on the student's
-- planner so they have to choose again if they still need it.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

drop policy if exists "staff reset study journal needs" on public.student_study_journal;
create policy "staff reset study journal needs"
  on public.student_study_journal for update
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());
