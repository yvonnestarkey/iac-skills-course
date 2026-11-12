-- Private weekly study journal. Students only — coaches cannot read these rows.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: it only adds missing tables/policies.

create table if not exists public.student_study_journal (
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  exam_on date,
  last_question text not null default '',
  questions_per_week integer,
  where_i_am text not null default '',
  week_need text not null default '',
  week_need_other text not null default '',
  week_goals text not null default '',
  days jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create index if not exists student_study_journal_user_week_idx
  on public.student_study_journal (user_id, week_start desc);

alter table public.student_study_journal enable row level security;

drop policy if exists "student study journal is private" on public.student_study_journal;
create policy "student study journal is private"
  on public.student_study_journal for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.student_study_journal to authenticated;
