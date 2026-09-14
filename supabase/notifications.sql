-- Real student notifications (announcements + assignment feedback).
-- Replaces the old inbox_messages view of the same name.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

drop view if exists public.notifications;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  message     text not null,
  type        text not null check (type in ('announcement', 'assignment_feedback')),
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications (user_id, read, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "students read own notifications" on public.notifications;
create policy "students read own notifications"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "students update own notifications" on public.notifications;
create policy "students update own notifications"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "staff read notifications" on public.notifications;
create policy "staff read notifications"
  on public.notifications for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff insert notifications" on public.notifications;
create policy "staff insert notifications"
  on public.notifications for insert
  to authenticated
  with check (public.is_course_staff());

grant select, insert, update on public.notifications to authenticated;

alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;
