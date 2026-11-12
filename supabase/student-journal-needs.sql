-- Study journal "what I need" alerts and audit trail for Yvonne.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: it only adds missing tables/policies.

create table if not exists public.student_journal_need_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  need_id text not null,
  need_other text not null default '',
  selected_at timestamptz not null default now(),
  cleared_at timestamptz,
  contacted_at timestamptz,
  contacted_by uuid
);

create index if not exists student_journal_need_events_open_idx
  on public.student_journal_need_events (need_id, selected_at desc)
  where cleared_at is null and contacted_at is null;

create index if not exists student_journal_need_events_user_idx
  on public.student_journal_need_events (user_id, selected_at desc);

alter table public.student_journal_need_events enable row level security;

drop policy if exists "students manage own journal need events" on public.student_journal_need_events;
create policy "students manage own journal need events"
  on public.student_journal_need_events for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "staff read shared journal need events" on public.student_journal_need_events;
create policy "staff read shared journal need events"
  on public.student_journal_need_events for select
  to authenticated
  using (
    public.is_course_staff()
    and not exists (
      select 1 from public.student_study_journal_settings s
      where s.user_id = student_journal_need_events.user_id
        and s.private = true
    )
  );

drop policy if exists "staff update journal need events" on public.student_journal_need_events;
create policy "staff update journal need events"
  on public.student_journal_need_events for update
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "staff insert journal need events" on public.student_journal_need_events;
create policy "staff insert journal need events"
  on public.student_journal_need_events for insert
  to authenticated
  with check (public.is_course_staff());

grant select, insert, update, delete on public.student_journal_need_events to authenticated;
