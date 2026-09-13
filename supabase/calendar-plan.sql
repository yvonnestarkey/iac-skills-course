-- Let the public iCal feed read a student's saved plan by user id.
-- Run this in the Supabase SQL editor if /student/planner subscribe 404s.

create or replace function public.calendar_plan(token text)
returns table (
  user_id uuid,
  start_date text,
  hours numeric,
  slots jsonb,
  makeups jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select p.user_id, p.start_date, p.hours, p.slots, p.makeups
  from public.study_plans p
  where p.user_id::text = token
  limit 1;
$$;

revoke all on function public.calendar_plan(text) from public;
grant execute on function public.calendar_plan(text) to anon, authenticated;
