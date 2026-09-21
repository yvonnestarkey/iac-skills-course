-- Allow a student to update their own custom-survey answers (same check-in, later reflection).
-- Paste into the Supabase SQL editor if the Task 4 checkpoint cannot save the post-video question.

drop policy if exists "students update own custom survey responses" on public.custom_survey_responses;
create policy "students update own custom survey responses"
  on public.custom_survey_responses for update
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);
