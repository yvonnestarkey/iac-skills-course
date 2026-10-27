-- Extra Reading & RTFQ practice questions for the student dashboard hub.
-- Course Task 2 still uses the lesson tools. These rows are the extra bank
-- students get after they submit the Task 2 assignment.

create table if not exists public.reading_practice_exercises (
  id text primary key,
  title text not null,
  area text not null default '',
  published boolean not null default true,
  position integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.reading_practice_exercises enable row level security;

drop policy if exists "students read published reading practice" on public.reading_practice_exercises;
create policy "students read published reading practice"
  on public.reading_practice_exercises for select
  to authenticated
  using (published = true or public.is_course_staff());

drop policy if exists "staff manage reading practice" on public.reading_practice_exercises;
create policy "staff manage reading practice"
  on public.reading_practice_exercises for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.reading_practice_exercises to authenticated;
