-- Staff can read every student's lesson progress, and we keep opened / watch
-- fields so the roster can tell a click from actually going through the lesson.

alter table public.lesson_progress add column if not exists opened_at timestamptz;
alter table public.lesson_progress add column if not exists last_opened_at timestamptz;
alter table public.lesson_progress add column if not exists video_seconds integer not null default 0;
alter table public.lesson_progress add column if not exists video_percent integer not null default 0;

update public.lesson_progress
set opened_at = coalesce(opened_at, updated_at),
    last_opened_at = coalesce(last_opened_at, updated_at)
where opened_at is null or last_opened_at is null;

drop policy if exists "staff read lesson progress" on public.lesson_progress;
create policy "staff read lesson progress"
  on public.lesson_progress for select
  to authenticated
  using (public.is_course_staff());
