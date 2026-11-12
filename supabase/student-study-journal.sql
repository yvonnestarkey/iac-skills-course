-- Weekly study journal. Visible to Yvonne unless the student opts out.
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

create table if not exists public.student_study_journal_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  private boolean not null default false,
  prompt_seen boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.student_study_journal enable row level security;
alter table public.student_study_journal_settings enable row level security;

drop policy if exists "student study journal is private" on public.student_study_journal;
drop policy if exists "students manage own study journal" on public.student_study_journal;
create policy "students manage own study journal"
  on public.student_study_journal for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "staff read shared study journals" on public.student_study_journal;
create policy "staff read shared study journals"
  on public.student_study_journal for select
  to authenticated
  using (
    public.is_course_staff()
    and not exists (
      select 1 from public.student_study_journal_settings s
      where s.user_id = student_study_journal.user_id
        and s.private = true
    )
  );

drop policy if exists "students manage own study journal settings" on public.student_study_journal_settings;
create policy "students manage own study journal settings"
  on public.student_study_journal_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "staff read study journal settings" on public.student_study_journal_settings;
create policy "staff read study journal settings"
  on public.student_study_journal_settings for select
  to authenticated
  using (public.is_course_staff());

grant select, insert, update, delete on public.student_study_journal to authenticated;
grant select, insert, update, delete on public.student_study_journal_settings to authenticated;
