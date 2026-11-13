-- PDF attachments on inbox messages (coach and student).
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

alter table public.inbox_messages
  add column if not exists pdf_url text,
  add column if not exists pdf_name text;

insert into storage.buckets (id, name, public)
values ('course-pdfs', 'course-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "students upload inbox pdfs" on storage.objects;
create policy "students upload inbox pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'inbox'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "students update own inbox pdfs" on storage.objects;
create policy "students update own inbox pdfs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'inbox'
    and split_part(name, '/', 2) = auth.uid()::text
  )
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'inbox'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "staff upload course pdfs" on storage.objects;
create policy "staff upload course pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('course-pdfs', 'lesson-banners')
    and public.is_course_staff()
  );
