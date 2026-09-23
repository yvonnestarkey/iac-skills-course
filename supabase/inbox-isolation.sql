-- Tighten student inbox / notifications isolation on an existing project.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create index if not exists inbox_messages_student_id_idx
  on public.inbox_messages (student_id, created_at);

-- Attach older email-only rows to the matching Auth account.
update public.inbox_messages m
set student_id = p.id
from public.profiles p
where m.student_id is null
  and lower(m.student_email) = lower(p.email);

update public.inbox_messages m
set student_id = u.id
from auth.users u
where m.student_id is null
  and lower(m.student_email) = lower(coalesce(u.email, ''));

create or replace function public.is_course_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('coach', 'admin'), false)
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'coach@accountingstudyadvice.com',
      'admin@accountingstudyadvice.com',
      'yvonne@accountingstudyadvice.com'
    );
$$;

revoke all on function public.is_course_staff() from public;
grant execute on function public.is_course_staff() to authenticated;

alter table public.inbox_messages enable row level security;

drop policy if exists "inbox readable by course users" on public.inbox_messages;
drop policy if exists "inbox writable by course users" on public.inbox_messages;
drop policy if exists "students read own inbox" on public.inbox_messages;
drop policy if exists "staff read inbox" on public.inbox_messages;
drop policy if exists "students insert own inbox" on public.inbox_messages;
drop policy if exists "staff insert inbox" on public.inbox_messages;

create policy "students read own inbox"
  on public.inbox_messages for select
  to authenticated
  using (auth.uid() = student_id);

create policy "staff read inbox"
  on public.inbox_messages for select
  to authenticated
  using (public.is_course_staff());

create policy "students insert own inbox"
  on public.inbox_messages for insert
  to authenticated
  with check (auth.uid() = student_id and from_role = 'student');

create policy "staff insert inbox"
  on public.inbox_messages for insert
  to authenticated
  with check (public.is_course_staff());

-- Notifications now live in public.notifications (see supabase/notifications.sql).
