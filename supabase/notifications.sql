-- Real student notifications (announcements + assignment feedback).
-- Replaces the old inbox_messages view of the same name.
-- Also run supabase/notifications-coach-insert.sql so coaches can INSERT.

drop view if exists public.notifications;

create table if not exists public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid references auth.users (id) on delete cascade,
  student_id     uuid references auth.users (id) on delete cascade,
  student_email  text,
  from_role      text not null default 'coach',
  kind           text,
  title          text,
  message        text,
  body           text,
  type           text,
  read           boolean not null default false,
  created_at     timestamptz not null default now()
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
