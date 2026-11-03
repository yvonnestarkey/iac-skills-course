-- Coach-only PDF repository on each student profile.
-- For files they email that are not a course submission.
-- Paste into the Supabase SQL editor. Safe to run more than once.

create table if not exists public.student_pdfs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  file_name text not null,
  file_url text not null,
  storage_path text not null,
  uploaded_by text,
  created_at timestamptz not null default now()
);

create index if not exists student_pdfs_student_idx
  on public.student_pdfs (student_id, created_at desc);

alter table public.student_pdfs enable row level security;

drop policy if exists "staff manage student pdfs" on public.student_pdfs;
create policy "staff manage student pdfs"
  on public.student_pdfs for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());
