-- Private dashboard notes. Students only — coaches cannot read these rows.
-- Run this in the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.student_notes (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  body        text not null default '',
  updated_at  timestamptz not null default now()
);

alter table public.student_notes enable row level security;

drop policy if exists "student notes are private" on public.student_notes;
create policy "student notes are private"
  on public.student_notes for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
