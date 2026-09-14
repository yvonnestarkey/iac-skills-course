-- Duration metadata for sidebar badges and the study planner.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.lessons add column if not exists video_duration_seconds integer;
alter table public.lessons add column if not exists estimated_read_minutes integer;
alter table public.lessons add column if not exists duration_minutes integer;

update public.lessons
set video_duration_seconds = seconds
where video_duration_seconds is null
  and seconds is not null
  and seconds > 0
  and type = 'video';

update public.lessons
set estimated_read_minutes = nullif(substring(duration from '\d+'), '')::int
where estimated_read_minutes is null
  and type = 'reading'
  and duration ~ '\d+';

update public.lessons
set duration_minutes = coalesce(
  duration_minutes,
  case
    when video_duration_seconds is not null and video_duration_seconds > 0
      then greatest(1, ceil(video_duration_seconds::numeric / 60.0)::int)
  end,
  estimated_read_minutes,
  case
    when seconds is not null and seconds > 0
      then greatest(1, ceil(seconds::numeric / 60.0)::int)
  end,
  case
    when duration ~ '^\d+:\d+'
      then greatest(
        1,
        ceil(
          (
            split_part(duration, ':', 1)::numeric * 60
            + split_part(regexp_replace(duration, '[^0-9:].*$', ''), ':', 2)::numeric
          ) / 60.0
        )::int
      )
    when duration ~ '\d+'
      then greatest(1, substring(duration from '\d+')::int)
  end,
  case type
    when 'video' then 10
    when 'reading' then 5
    when 'assignment' then 60
    when 'upload' then 40
    when 'survey' then 5
    when 'ask' then 10
    else 10
  end
);
