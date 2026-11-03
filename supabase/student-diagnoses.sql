-- Coach diagnoses on student profiles (RTFQ, Case Study Reading, and later additions).
-- Paste into the Supabase SQL editor. Safe to run more than once.

create table if not exists public.student_diagnosis_types (
  id text primary key,
  label text not null,
  position int not null default 0
);

insert into public.student_diagnosis_types (id, label, position) values
  ('rtfq', 'RTFQ', 1),
  ('case-study-reading', 'Case Study Reading', 2)
on conflict (id) do update
  set label = excluded.label,
      position = excluded.position;

create table if not exists public.student_diagnoses (
  student_id uuid not null references auth.users (id) on delete cascade,
  diagnosis_id text not null,
  created_at timestamptz not null default now(),
  primary key (student_id, diagnosis_id)
);

create index if not exists student_diagnoses_diagnosis_idx
  on public.student_diagnoses (diagnosis_id, student_id);

alter table public.student_diagnosis_types enable row level security;
alter table public.student_diagnoses enable row level security;

drop policy if exists "staff read diagnosis types" on public.student_diagnosis_types;
create policy "staff read diagnosis types"
  on public.student_diagnosis_types for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff manage diagnosis types" on public.student_diagnosis_types;
create policy "staff manage diagnosis types"
  on public.student_diagnosis_types for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "staff manage student diagnoses" on public.student_diagnoses;
create policy "staff manage student diagnoses"
  on public.student_diagnoses for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());
