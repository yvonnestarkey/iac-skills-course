-- Allow coaches to store marked PDFs on submissions (same bucket as survey PDFs).
-- Paste into the Supabase SQL editor, then try the upload again.

insert into storage.buckets (id, name, public)
values ('course-pdfs', 'course-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "students upload survey response pdfs" on storage.objects;
create policy "students upload survey response pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'survey-responses'
    and split_part(name, '/', 3) = auth.uid()::text
  );

drop policy if exists "staff upload course pdfs" on storage.objects;
create policy "staff upload course pdfs"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id in ('course-pdfs', 'lesson-banners')
    and public.is_course_staff()
  );

drop policy if exists "staff update course pdfs" on storage.objects;
create policy "staff update course pdfs"
  on storage.objects for update
  to authenticated
  using (
    bucket_id in ('course-pdfs', 'lesson-banners')
    and public.is_course_staff()
  )
  with check (
    bucket_id in ('course-pdfs', 'lesson-banners')
    and public.is_course_staff()
  );
