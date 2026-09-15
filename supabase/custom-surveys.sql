-- Custom code-free surveys (coach-built, student-rendered).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: adds missing columns before creating indexes.

create table if not exists public.custom_surveys (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  description text not null default '',
  slug text not null default '',
  is_active boolean not null default false,
  questions jsonb not null default '[]'::jsonb
);

alter table public.custom_surveys add column if not exists title text not null default '';
alter table public.custom_surveys add column if not exists description text not null default '';
alter table public.custom_surveys add column if not exists slug text not null default '';
alter table public.custom_surveys add column if not exists is_active boolean not null default false;
alter table public.custom_surveys add column if not exists questions jsonb not null default '[]'::jsonb;
alter table public.custom_surveys add column if not exists created_at timestamptz not null default now();
alter table public.custom_surveys add column if not exists updated_at timestamptz not null default now();

create unique index if not exists custom_surveys_slug_uidx
  on public.custom_surveys (slug);

create index if not exists custom_surveys_active_idx
  on public.custom_surveys (is_active, created_at desc);

create table if not exists public.custom_survey_responses (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.custom_surveys (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb not null default '{}'::jsonb
);

alter table public.custom_survey_responses add column if not exists survey_id uuid;
alter table public.custom_survey_responses add column if not exists student_id uuid;
alter table public.custom_survey_responses add column if not exists answers jsonb not null default '{}'::jsonb;
alter table public.custom_survey_responses add column if not exists created_at timestamptz not null default now();

create unique index if not exists custom_survey_responses_survey_student_uidx
  on public.custom_survey_responses (survey_id, student_id);

create index if not exists custom_survey_responses_survey_idx
  on public.custom_survey_responses (survey_id, created_at desc);

alter table public.custom_surveys enable row level security;
alter table public.custom_survey_responses enable row level security;

drop policy if exists "students read active custom surveys" on public.custom_surveys;
create policy "students read active custom surveys"
  on public.custom_surveys for select
  to authenticated
  using (is_active = true or public.is_course_staff());

drop policy if exists "staff manage custom surveys" on public.custom_surveys;
create policy "staff manage custom surveys"
  on public.custom_surveys for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "students read own custom survey responses" on public.custom_survey_responses;
create policy "students read own custom survey responses"
  on public.custom_survey_responses for select
  to authenticated
  using (auth.uid() = student_id or public.is_course_staff());

drop policy if exists "students insert own custom survey responses" on public.custom_survey_responses;
create policy "students insert own custom survey responses"
  on public.custom_survey_responses for insert
  to authenticated
  with check (auth.uid() = student_id);

drop policy if exists "staff manage custom survey responses" on public.custom_survey_responses;
create policy "staff manage custom survey responses"
  on public.custom_survey_responses for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.custom_surveys to authenticated;
grant select, insert, update, delete on public.custom_survey_responses to authenticated;
