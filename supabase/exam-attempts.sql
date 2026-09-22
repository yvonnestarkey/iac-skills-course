-- Script Evaluator exam attempts: one student → many independent sittings/papers.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Does not alter script_evaluations, mark_report_uploads, BMCR, Volume, or Buried Treasure data.

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exam_body text not null default 'IAC',
  sitting_id text not null,
  paper_id text not null,
  sitting_label text not null default '',
  paper_title text not null default '',
  paper_code text not null default '',
  status text not null default 'started'
    check (status in (
      'started',
      'awaiting_documents',
      'ready_to_submit',
      'analysing',
      'evidence_ready',
      'report_ready',
      'analysis_failed'
    )),
  bmcr_worksheet_path text,
  bmcr_worksheet_url text,
  bmcr_worksheet_name text,
  marked_script_path text,
  marked_script_url text,
  marked_script_name text,
  marking_report_path text,
  marking_report_url text,
  marking_report_name text,
  page_images jsonb not null default '{}'::jsonb,
  evidence_pack jsonb,
  evaluation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create index if not exists exam_attempts_user_created_idx
  on public.exam_attempts (user_id, created_at desc);

alter table public.exam_attempts enable row level security;

drop policy if exists "students read own exam attempts" on public.exam_attempts;
create policy "students read own exam attempts"
  on public.exam_attempts for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "students insert own exam attempts" on public.exam_attempts;
create policy "students insert own exam attempts"
  on public.exam_attempts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "students update own exam attempts" on public.exam_attempts;
create policy "students update own exam attempts"
  on public.exam_attempts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "staff update exam attempts" on public.exam_attempts;
create policy "staff update exam attempts"
  on public.exam_attempts for update
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update on public.exam_attempts to authenticated;

-- PDFs and page images: course-pdfs/exam-attempts/{userId}/{attemptId}/...
insert into storage.buckets (id, name, public)
values ('course-pdfs', 'course-pdfs', true)
on conflict (id) do nothing;

drop policy if exists "students upload exam attempt files" on storage.objects;
create policy "students upload exam attempt files"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'exam-attempts'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "students update own exam attempt files" on storage.objects;
create policy "students update own exam attempt files"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'exam-attempts'
    and split_part(name, '/', 2) = auth.uid()::text
  )
  with check (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'exam-attempts'
    and split_part(name, '/', 2) = auth.uid()::text
  );

drop policy if exists "students read own exam attempt files" on storage.objects;
create policy "students read own exam attempt files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'course-pdfs'
    and split_part(name, '/', 1) = 'exam-attempts'
    and split_part(name, '/', 2) = auth.uid()::text
  );
