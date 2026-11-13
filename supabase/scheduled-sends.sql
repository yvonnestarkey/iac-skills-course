-- Scheduled notifications and inbox messages.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

create table if not exists public.scheduled_sends (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'notification',
  message_kind text not null default 'reply',
  title text not null default '',
  body text not null default '',
  pdf_url text,
  pdf_name text,
  audience text not null default 'student',
  audience_label text,
  recipients jsonb not null default '[]'::jsonb,
  trigger_type text not null default 'at_time',
  send_at timestamptz,
  lesson_id text,
  task_id text,
  created_by uuid,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz
);

alter table public.scheduled_sends add column if not exists channel text not null default 'notification';
alter table public.scheduled_sends add column if not exists message_kind text not null default 'reply';
alter table public.scheduled_sends add column if not exists title text not null default '';
alter table public.scheduled_sends add column if not exists body text not null default '';
alter table public.scheduled_sends add column if not exists pdf_url text;
alter table public.scheduled_sends add column if not exists pdf_name text;
alter table public.scheduled_sends add column if not exists audience text not null default 'student';
alter table public.scheduled_sends add column if not exists audience_label text;
alter table public.scheduled_sends add column if not exists recipients jsonb not null default '[]'::jsonb;
alter table public.scheduled_sends add column if not exists trigger_type text not null default 'at_time';
alter table public.scheduled_sends add column if not exists send_at timestamptz;
alter table public.scheduled_sends add column if not exists lesson_id text;
alter table public.scheduled_sends add column if not exists task_id text;
alter table public.scheduled_sends add column if not exists created_by uuid;
alter table public.scheduled_sends add column if not exists created_at timestamptz not null default now();
alter table public.scheduled_sends add column if not exists cancelled_at timestamptz;

alter table public.scheduled_sends drop constraint if exists scheduled_sends_channel_check;
alter table public.scheduled_sends
  add constraint scheduled_sends_channel_check
  check (channel in ('notification', 'message'));

alter table public.scheduled_sends drop constraint if exists scheduled_sends_trigger_check;
alter table public.scheduled_sends
  add constraint scheduled_sends_trigger_check
  check (trigger_type in ('at_time', 'lesson_completed', 'task_submitted'));

create index if not exists scheduled_sends_open_idx
  on public.scheduled_sends (cancelled_at, trigger_type, send_at)
  where cancelled_at is null;

create table if not exists public.scheduled_send_deliveries (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references public.scheduled_sends (id) on delete cascade,
  student_id uuid not null references auth.users (id) on delete cascade,
  delivered_at timestamptz not null default now()
);

create unique index if not exists scheduled_send_deliveries_uidx
  on public.scheduled_send_deliveries (send_id, student_id);

create index if not exists scheduled_send_deliveries_student_idx
  on public.scheduled_send_deliveries (student_id, delivered_at desc);

alter table public.scheduled_sends enable row level security;
alter table public.scheduled_send_deliveries enable row level security;

drop policy if exists "staff manage scheduled sends" on public.scheduled_sends;
create policy "staff manage scheduled sends"
  on public.scheduled_sends for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "staff read scheduled send deliveries" on public.scheduled_send_deliveries;
create policy "staff read scheduled send deliveries"
  on public.scheduled_send_deliveries for select
  to authenticated
  using (public.is_course_staff());

grant select, insert, update, delete on public.scheduled_sends to authenticated;
grant select on public.scheduled_send_deliveries to authenticated;
