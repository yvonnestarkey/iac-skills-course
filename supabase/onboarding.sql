-- Post-registration onboarding.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.profiles add column if not exists phone_number text;
alter table public.profiles add column if not exists accountability_email text;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

create table if not exists public.student_profiles (
  student_id uuid primary key references auth.users (id) on delete cascade,
  demographics jsonb not null default '{}'::jsonb,
  qualitative_notes jsonb not null default '{}'::jsonb,
  onboarding_completed boolean not null default false,
  onboarding_skipped boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.student_profiles add column if not exists onboarding_skipped boolean not null default false;

alter table public.student_profiles enable row level security;

drop policy if exists "students read own student profile" on public.student_profiles;
create policy "students read own student profile"
  on public.student_profiles for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "students write own student profile" on public.student_profiles;
create policy "students write own student profile"
  on public.student_profiles for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "staff read student profiles" on public.student_profiles;
create policy "staff read student profiles"
  on public.student_profiles for select
  to authenticated
  using (public.is_course_staff());
