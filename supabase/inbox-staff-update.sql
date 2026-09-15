-- Allow coaches to mark a student thread as replied/resolved.
-- Paste into the Supabase SQL editor after supabase/inbox-read.sql.

drop policy if exists "staff update inbox" on public.inbox_messages;
create policy "staff update inbox"
  on public.inbox_messages for update
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update on public.inbox_messages to authenticated;
