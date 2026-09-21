-- Submission gates for the student player.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.lessons add column if not exists requires_submission boolean not null default false;
alter table public.lessons add column if not exists requires_coach_approval boolean not null default false;
alter table public.lessons add column if not exists prereq_lesson_id text;

update public.lessons
set requires_submission = true
where type = 'assignment'
  and requires_submission = false;

-- Point the next lesson at any submission-gated lesson so students cannot skip it.
with ordered as (
  select
    l.id,
    l.requires_submission,
    l.requires_coach_approval,
    lag(l.id) over (order by coalesce(c.position, 0), l.position, l.id) as prev_id,
    lag(l.requires_submission) over (order by coalesce(c.position, 0), l.position, l.id) as prev_sub,
    lag(l.requires_coach_approval) over (order by coalesce(c.position, 0), l.position, l.id) as prev_appr
  from public.lessons l
  left join public.chapters c on c.id = l.chapter_id
)
update public.lessons l
set prereq_lesson_id = ordered.prev_id
from ordered
where l.id = ordered.id
  and l.prereq_lesson_id is null
  and (coalesce(ordered.prev_sub, false) or coalesce(ordered.prev_appr, false));

-- Phase 1 and Task 1 teaching stay open after registration.
-- Only lessons after the first numbered Task assignment wait on that submission.
with ordered as (
  select
    l.id,
    row_number() over (order by coalesce(c.position, 0), l.position, l.id) as rn,
    case
      when c.title ~* '^Task[[:space:]]+[0-9]+'
        and c.title !~* 'Extra'
        and l.type in ('assignment', 'upload')
        and l.title !~* 'DIY'
      then l.id
    end as main_task_id
  from public.lessons l
  left join public.chapters c on c.id = l.chapter_id
),
first_task as (
  select min(rn) as rn from ordered where main_task_id is not null
)
update public.lessons l
set prereq_lesson_id = null
from ordered, first_task
where l.id = ordered.id
  and ordered.rn <= first_task.rn;

-- Task chapters: every assignment (except DIY) uses the requires-submission rule.
-- Later Tasks stay locked until the previous numbered Task assignment is submitted.
update public.lessons l
set requires_submission = true
from public.chapters c
where l.chapter_id = c.id
  and c.title ~* '^Task '
  and l.type in ('assignment', 'upload')
  and l.title !~* 'DIY';

update public.lessons l
set requires_submission = false
from public.chapters c
where l.chapter_id = c.id
  and c.title ~* '^Task '
  and l.title ~* 'DIY';

with ordered as (
  select
    l.id,
    row_number() over (order by coalesce(c.position, 0), l.position, l.id) as rn,
    case
      when c.title ~* '^Task[[:space:]]+[0-9]+'
        and c.title !~* 'Extra'
        and l.type in ('assignment', 'upload')
        and l.title !~* 'DIY'
      then l.id
    end as main_task_id
  from public.lessons l
  left join public.chapters c on c.id = l.chapter_id
),
with_prev as (
  select
    o.id,
    (
      select o2.main_task_id
      from ordered o2
      where o2.rn < o.rn
        and o2.main_task_id is not null
      order by o2.rn desc
      limit 1
    ) as prev_task_id
  from ordered o
)
update public.lessons l
set prereq_lesson_id = with_prev.prev_task_id
from with_prev
where l.id = with_prev.id
  and with_prev.prev_task_id is not null;

create table if not exists public.student_submissions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references auth.users (id) on delete cascade,
  lesson_id    text not null,
  body         text not null default '',
  link_url     text not null default '',
  status       text not null default 'submitted' check (status in ('submitted', 'approved', 'rejected')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (student_id, lesson_id)
);

create index if not exists student_submissions_student_idx
  on public.student_submissions (student_id, lesson_id);

alter table public.student_submissions enable row level security;

drop policy if exists "students read own submissions" on public.student_submissions;
create policy "students read own submissions"
  on public.student_submissions for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "students insert own submissions" on public.student_submissions;
create policy "students insert own submissions"
  on public.student_submissions for insert
  to authenticated
  with check (auth.uid() = student_id and status = 'submitted');

drop policy if exists "students update own submissions" on public.student_submissions;
create policy "students update own submissions"
  on public.student_submissions for update
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id and status = 'submitted');

drop policy if exists "staff read submissions" on public.student_submissions;
create policy "staff read submissions"
  on public.student_submissions for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff insert submissions" on public.student_submissions;
create policy "staff insert submissions"
  on public.student_submissions for insert
  to authenticated
  with check (public.is_course_staff());

drop policy if exists "staff update submissions" on public.student_submissions;
create policy "staff update submissions"
  on public.student_submissions for update
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update on public.student_submissions to authenticated;

-- Student assignment PDFs (Task 1, Task 2, …) in course-pdfs/assignment-submissions/{studentId}/...
insert into storage.buckets (id, name, public)
values ('course-pdfs', 'course-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "students upload assignment pdfs" on storage.objects;
create policy "students upload assignment pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "students update own assignment pdfs" on storage.objects;
create policy "students update own assignment pdfs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  )
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "students read own assignment pdfs" on storage.objects;
create policy "students read own assignment pdfs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );
