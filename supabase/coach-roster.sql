-- Coach roster column preferences.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.coach_roster_preferences (
  coach_id uuid primary key references auth.users (id) on delete cascade,
  visible_columns text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

alter table public.coach_roster_preferences enable row level security;

drop policy if exists "coaches read own roster preferences" on public.coach_roster_preferences;
create policy "coaches read own roster preferences"
  on public.coach_roster_preferences for select
  to authenticated
  using (auth.uid() = coach_id and public.is_course_staff());

drop policy if exists "coaches write own roster preferences" on public.coach_roster_preferences;
create policy "coaches write own roster preferences"
  on public.coach_roster_preferences for all
  to authenticated
  using (auth.uid() = coach_id and public.is_course_staff())
  with check (auth.uid() = coach_id and public.is_course_staff());

grant select, insert, update, delete on public.coach_roster_preferences to authenticated;
