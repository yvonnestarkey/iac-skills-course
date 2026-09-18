-- Student mark-report uploads for the script evaluator gate.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- PDFs go into the existing course-pdfs bucket at survey-responses/mark-report/{userId}/...

create table if not exists public.mark_report_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paper_name text not null default '',
  file_url text not null,
  file_name text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists mark_report_uploads_user_created_idx
  on public.mark_report_uploads (user_id, created_at desc);

alter table public.mark_report_uploads enable row level security;

drop policy if exists "students read own mark reports" on public.mark_report_uploads;
create policy "students read own mark reports"
  on public.mark_report_uploads for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "students insert own mark reports" on public.mark_report_uploads;
create policy "students insert own mark reports"
  on public.mark_report_uploads for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.mark_report_uploads to authenticated;
