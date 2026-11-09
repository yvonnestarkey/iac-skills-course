-- Study Clinic library pages: PDFs, videos, and links, plus editable intro copy.
-- Paste into the Supabase SQL editor after study-clinic.sql and study-clinic-sections.sql.
-- Safe to re-run.

alter table public.study_clinic
  add column if not exists kind text not null default 'video';

alter table public.study_clinic
  add column if not exists resource_url text;

alter table public.study_clinic
  add column if not exists resource_label text;

update public.study_clinic
set kind = 'video'
where coalesce(kind, '') = ''
   or kind not in ('video', 'pdf', 'link');

create table if not exists public.study_clinic_pages (
  section text primary key,
  intro text not null default '',
  body text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.study_clinic_pages enable row level security;

drop policy if exists "students read study clinic pages" on public.study_clinic_pages;
create policy "students read study clinic pages"
  on public.study_clinic_pages for select
  to authenticated
  using (true);

drop policy if exists "staff manage study clinic pages" on public.study_clinic_pages;
create policy "staff manage study clinic pages"
  on public.study_clinic_pages for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.study_clinic_pages to authenticated;

notify pgrst, 'reload schema';
