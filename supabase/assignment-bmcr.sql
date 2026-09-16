-- Student BMCR (Basic Mark Conversion Ratio) evaluations.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

-- assignment_id is the lesson id (text), matching public.lessons.id.
create table if not exists public.assignment_bmcr_evaluations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.profiles(id) on delete cascade,
  assignment_id text,
  basic_my_marks numeric not null default 0,
  basic_markplan numeric not null default 0,
  average_my_marks numeric not null default 0,
  average_markplan numeric not null default 0,
  higher_my_marks numeric not null default 0,
  higher_markplan numeric not null default 0,
  question_total_my_marks numeric not null default 0,
  question_total_markplan numeric not null default 0,
  basic_mark_pct numeric generated always as (
    case when question_total_markplan > 0 then (basic_markplan / question_total_markplan) * 100 else 0 end
  ) stored,
  bmcr_conversion_pct numeric generated always as (
    case when basic_markplan > 0 then (basic_my_marks / basic_markplan) * 100 else 0 end
  ) stored,
  challenges text[],
  key_takeaways text,
  submitted_at timestamptz default now()
);

alter table public.assignment_bmcr_evaluations
  add column if not exists feels_needs_theory boolean;
alter table public.assignment_bmcr_evaluations
  add column if not exists feelings_reliable boolean;

-- If this table was created earlier with uuid assignment_id, store lesson ids as text.
alter table public.assignment_bmcr_evaluations
  alter column assignment_id type text using assignment_id::text;

create unique index if not exists assignment_bmcr_student_assignment_uidx
  on public.assignment_bmcr_evaluations (student_id, assignment_id);

create index if not exists assignment_bmcr_student_idx
  on public.assignment_bmcr_evaluations (student_id, submitted_at desc);

alter table public.assignment_bmcr_evaluations enable row level security;

drop policy if exists "students read own bmcr evaluations" on public.assignment_bmcr_evaluations;
create policy "students read own bmcr evaluations"
  on public.assignment_bmcr_evaluations for select
  to authenticated
  using (auth.uid() = student_id or public.is_course_staff());

drop policy if exists "students insert own bmcr evaluations" on public.assignment_bmcr_evaluations;
create policy "students insert own bmcr evaluations"
  on public.assignment_bmcr_evaluations for insert
  to authenticated
  with check (auth.uid() = student_id);

drop policy if exists "students update own bmcr evaluations" on public.assignment_bmcr_evaluations;
create policy "students update own bmcr evaluations"
  on public.assignment_bmcr_evaluations for update
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "staff manage bmcr evaluations" on public.assignment_bmcr_evaluations;
create policy "staff manage bmcr evaluations"
  on public.assignment_bmcr_evaluations for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant all on public.assignment_bmcr_evaluations to authenticated;
