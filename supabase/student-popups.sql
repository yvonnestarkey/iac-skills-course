-- Targeted login pop-ups: filters, activities, commitments, answers, dismissals.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

alter table public.dashboard_posts add column if not exists filters jsonb not null default '[]'::jsonb;
alter table public.dashboard_posts add column if not exists filter_logic text not null default 'and';
alter table public.dashboard_posts add column if not exists items jsonb not null default '[]'::jsonb;

alter table public.dashboard_posts drop constraint if exists dashboard_posts_filter_logic_check;
alter table public.dashboard_posts
  add constraint dashboard_posts_filter_logic_check
  check (filter_logic in ('and', 'or'));

drop index if exists public.dashboard_posts_one_live_idx;
create unique index if not exists dashboard_posts_one_live_announcement_idx
  on public.dashboard_posts (kind)
  where status = 'published' and kind = 'announcement';

create table if not exists public.student_popup_dismissals (
  popup_id uuid not null references public.dashboard_posts (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  mode text not null check (mode in ('forever', 'today')),
  on_date date not null,
  created_at timestamptz not null default now(),
  primary key (popup_id, student_id)
);

create table if not exists public.student_popup_responses (
  id uuid primary key default gen_random_uuid(),
  popup_id uuid not null references public.dashboard_posts (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  item_id text not null,
  kind text not null check (kind in ('commitment', 'answer')),
  accepted boolean,
  answer text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (popup_id, student_id, item_id)
);

create index if not exists student_popup_responses_student_idx
  on public.student_popup_responses (student_id, updated_at desc);

alter table public.student_popup_dismissals enable row level security;
alter table public.student_popup_responses enable row level security;

drop policy if exists "students manage own popup dismissals" on public.student_popup_dismissals;
create policy "students manage own popup dismissals"
  on public.student_popup_dismissals for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "staff read popup dismissals" on public.student_popup_dismissals;
create policy "staff read popup dismissals"
  on public.student_popup_dismissals for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "students manage own popup responses" on public.student_popup_responses;
create policy "students manage own popup responses"
  on public.student_popup_responses for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "staff read popup responses" on public.student_popup_responses;
create policy "staff read popup responses"
  on public.student_popup_responses for select
  to authenticated
  using (public.is_course_staff());

grant select, insert, update, delete on public.student_popup_dismissals to authenticated;
grant select, insert, update, delete on public.student_popup_responses to authenticated;
