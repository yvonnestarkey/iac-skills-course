-- Source-material transcripts for course Vimeo videos.
-- Paste into the Supabase SQL editor. Does not drop or alter existing tables.

create table if not exists public.lesson_transcripts (
  id uuid primary key default gen_random_uuid(),
  lesson_id text not null,
  vimeo_video_id text not null,
  source_provider text not null default 'vimeo',
  language text not null default 'en',
  transcript_text text not null default '',
  caption_vtt text,
  cues jsonb not null default '[]'::jsonb,
  provenance jsonb not null default '{}'::jsonb,
  retrieved_at timestamptz,
  source_updated_at timestamptz,
  source_hash text,
  status text not null default 'pending'
    check (status in ('pending', 'imported', 'no_captions', 'inaccessible', 'error', 'ambiguous')),
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lesson_id, vimeo_video_id, language)
);

create index if not exists lesson_transcripts_lesson_idx
  on public.lesson_transcripts (lesson_id);

create index if not exists lesson_transcripts_vimeo_idx
  on public.lesson_transcripts (vimeo_video_id);

create index if not exists lesson_transcripts_status_idx
  on public.lesson_transcripts (status);

alter table public.lesson_transcripts enable row level security;

drop policy if exists "staff read lesson transcripts" on public.lesson_transcripts;
create policy "staff read lesson transcripts"
  on public.lesson_transcripts for select
  to authenticated
  using (public.is_course_staff());

grant select on public.lesson_transcripts to authenticated;
grant all on public.lesson_transcripts to service_role;
