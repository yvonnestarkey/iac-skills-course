-- Automated drip-feed notifications for students.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

create table if not exists public.drip_messages (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  trigger_type text not null default 'enrolment_delay',
  delay_days integer,
  send_on date,
  lesson_id text,
  task_id text,
  scope text not null default 'static',
  cohort_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

alter table public.drip_messages add column if not exists title text not null default '';
alter table public.drip_messages add column if not exists body text not null default '';
alter table public.drip_messages add column if not exists trigger_type text not null default 'enrolment_delay';
alter table public.drip_messages add column if not exists delay_days integer;
alter table public.drip_messages add column if not exists send_on date;
alter table public.drip_messages add column if not exists lesson_id text;
alter table public.drip_messages add column if not exists task_id text;
alter table public.drip_messages add column if not exists scope text not null default 'static';
alter table public.drip_messages add column if not exists cohort_id text;
alter table public.drip_messages add column if not exists is_active boolean not null default true;
alter table public.drip_messages add column if not exists created_at timestamptz not null default now();
alter table public.drip_messages add column if not exists updated_at timestamptz not null default now();
alter table public.drip_messages add column if not exists created_by uuid;

alter table public.drip_messages drop constraint if exists drip_messages_trigger_check;
alter table public.drip_messages
  add constraint drip_messages_trigger_check
  check (trigger_type in ('enrolment_delay', 'fixed_date', 'lesson_completed', 'task_completed'));

alter table public.drip_messages drop constraint if exists drip_messages_scope_check;
alter table public.drip_messages
  add constraint drip_messages_scope_check
  check (scope in ('static', 'cohort'));

create index if not exists drip_messages_active_idx
  on public.drip_messages (is_active, trigger_type);

create table if not exists public.drip_deliveries (
  id uuid primary key default gen_random_uuid(),
  drip_id uuid not null references public.drip_messages (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  notification_id uuid,
  delivered_at timestamptz not null default now()
);

alter table public.drip_deliveries add column if not exists drip_id uuid;
alter table public.drip_deliveries add column if not exists user_id uuid;
alter table public.drip_deliveries add column if not exists notification_id uuid;
alter table public.drip_deliveries add column if not exists delivered_at timestamptz not null default now();

create unique index if not exists drip_deliveries_drip_user_uidx
  on public.drip_deliveries (drip_id, user_id);

create index if not exists drip_deliveries_user_idx
  on public.drip_deliveries (user_id, delivered_at desc);

alter table public.drip_messages enable row level security;
alter table public.drip_deliveries enable row level security;

drop policy if exists "staff manage drip messages" on public.drip_messages;
create policy "staff manage drip messages"
  on public.drip_messages for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "staff read drip deliveries" on public.drip_deliveries;
create policy "staff read drip deliveries"
  on public.drip_deliveries for select
  to authenticated
  using (public.is_course_staff());

grant select, insert, update, delete on public.drip_messages to authenticated;
grant select on public.drip_deliveries to authenticated;
