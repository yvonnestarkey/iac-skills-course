-- Allow students to upload assignment PDFs (Task 1, Task 2, …).
-- Paste into the Supabase SQL editor, then try the Task upload again.

insert into storage.buckets (id, name, public)
values ('course-pdfs', 'course-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "students upload assignment pdfs" on storage.objects;
create policy "students upload assignment pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "students update own assignment pdfs" on storage.objects;
create policy "students update own assignment pdfs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  )
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "students read own assignment pdfs" on storage.objects;
create policy "students read own assignment pdfs"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'assignment-submissions'
    and split_part(name, '/', 2) = auth.uid()::text
  );
