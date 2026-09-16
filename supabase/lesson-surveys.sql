-- Attach custom surveys to course lessons.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.lessons add column if not exists survey_id uuid;

create index if not exists lessons_survey_id_idx
  on public.lessons (survey_id);

alter table public.lessons drop constraint if exists lessons_type_check;
alter table public.lessons add constraint lessons_type_check
  check (type in ('video', 'reading', 'assignment', 'upload', 'download', 'ask', 'survey'));
