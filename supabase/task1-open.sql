-- Open Phase 2 Task 1 from registration.
-- Teaching lessons and the assignment itself have no prerequisite.
-- Later lessons still wait on the Task 1 submission.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

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
