-- Draft lessons: visible only in Coach View, hidden from students.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

alter table public.lessons
  add column if not exists is_draft boolean not null default false;

create index if not exists lessons_is_draft_idx
  on public.lessons (is_draft)
  where is_draft;

create or replace function public.list_lesson_catalog()
returns table (
  id text,
  title text,
  "type" text,
  duration text,
  seconds integer,
  chapter_id text,
  "position" integer,
  video_duration_seconds integer,
  estimated_read_minutes integer,
  duration_minutes integer,
  requires_submission boolean,
  requires_coach_approval boolean,
  prereq_lesson_id text,
  unlock_at timestamptz,
  survey_id uuid,
  is_draft boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.title,
    l.type as "type",
    l.duration,
    l.seconds,
    l.chapter_id,
    l.position as "position",
    l.video_duration_seconds,
    l.estimated_read_minutes,
    l.duration_minutes,
    l.requires_submission,
    l.requires_coach_approval,
    l.prereq_lesson_id,
    l.unlock_at,
    l.survey_id,
    coalesce(l.is_draft, false) as is_draft
  from public.lessons l
  order by l.chapter_id, l.position;
$$;

revoke all on function public.list_lesson_catalog() from public;
grant execute on function public.list_lesson_catalog() to authenticated;
