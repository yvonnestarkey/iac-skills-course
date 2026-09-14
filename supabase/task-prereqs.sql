-- Task chapter submission gates.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to run if you already ran supabase/submissions.sql.

alter table public.lessons add column if not exists requires_submission boolean not null default false;
alter table public.lessons add column if not exists requires_coach_approval boolean not null default false;
alter table public.lessons add column if not exists prereq_lesson_id text;

-- Every assignment in a Task chapter uses requires-submission, except DIY practice.
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

-- Later Tasks (and everything after a numbered Task assignment) wait on that submission.
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
