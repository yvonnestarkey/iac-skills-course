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

-- Flattened roster for coaches: profiles + parsed onboarding JSONB.
drop view if exists public.coach_student_roster_view;
create view public.coach_student_roster_view
with (security_invoker = true) as
select
  p.id,
  p.full_name,
  p.email,
  p.phone_number,
  p.accountability_email,
  p.cohort,
  p.last_active,
  p.created_at,
  p.role,
  coalesce(sp.onboarding_completed, false) as onboarding_completed,
  coalesce(sp.onboarding_skipped, false) as onboarding_skipped,
  coalesce(sp.demographics->>'country', '') as country,
  coalesce(sp.demographics->>'cta_institution', sp.demographics->>'cta_university', '') as cta_university,
  coalesce(sp.demographics->>'cta_year', sp.demographics->>'cta_year_passed', '') as cta_year,
  coalesce(sp.demographics->>'exam_attempts', sp.demographics->>'iac_attempt_count', '') as iac_attempts,
  case
    when coalesce(sp.demographics->>'written_before', sp.demographics->>'iac_written_exam_before', '') in ('true', 't', '1', 'yes') then true
    else false
  end as repeat_student,
  coalesce(sp.qualitative_notes->>'coaching_goals', sp.qualitative_notes->>'coaching_hopes', '') as coaching_goals,
  coalesce(sp.qualitative_notes->>'struggle_areas', sp.qualitative_notes->>'struggling_areas', '') as struggle_areas,
  sp.demographics,
  sp.qualitative_notes
from public.profiles p
left join public.student_profiles sp on sp.student_id = p.id
where p.role = 'student';

grant select on public.coach_student_roster_view to authenticated;
