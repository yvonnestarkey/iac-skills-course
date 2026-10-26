-- One attempt per reading task. Students cannot redo; coaches reset from the student profile.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query). Safe to re-run.

delete from public.reading_attempts a
where a.id not in (
  select distinct on (user_id, exercise_id) id
  from public.reading_attempts
  order by user_id, exercise_id, created_at desc, id desc
);

delete from public.reading_checks a
where a.id not in (
  select distinct on (user_id, check_id) id
  from public.reading_checks
  order by user_id, check_id, created_at desc, id desc
);

create unique index if not exists reading_attempts_user_exercise_uidx
  on public.reading_attempts (user_id, exercise_id);

create unique index if not exists reading_checks_user_check_uidx
  on public.reading_checks (user_id, check_id);

drop policy if exists "staff delete reading attempts" on public.reading_attempts;
create policy "staff delete reading attempts"
  on public.reading_attempts for delete to authenticated
  using (public.is_course_staff());

drop policy if exists "staff delete reading checks" on public.reading_checks;
create policy "staff delete reading checks"
  on public.reading_checks for delete to authenticated
  using (public.is_course_staff());

drop policy if exists "staff delete reading mark calls" on public.reading_mark_calls;
create policy "staff delete reading mark calls"
  on public.reading_mark_calls for delete to authenticated
  using (public.is_course_staff());

grant delete on public.reading_attempts to authenticated;
grant delete on public.reading_checks to authenticated;
grant delete on public.reading_mark_calls to authenticated;
