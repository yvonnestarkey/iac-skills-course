-- Student inbox read receipts for the envelope badge on /student/inbox.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

alter table public.inbox_messages
  add column if not exists read boolean not null default false;

alter table public.inbox_messages
  add column if not exists read_at timestamptz;

create index if not exists inbox_messages_student_unread_idx
  on public.inbox_messages (student_id, read, created_at desc);

drop policy if exists "students update own inbox read state" on public.inbox_messages;
create policy "students update own inbox read state"
  on public.inbox_messages for update
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

grant select, insert, update on public.inbox_messages to authenticated;
