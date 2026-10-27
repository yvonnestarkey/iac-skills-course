-- Study Clinic videos. Paste this first.
-- These currently live in public.lessons under Common Fixes / chapter ch11.
-- This creates public.study_clinic and copies the video rows across.
-- Safe to re-run.

create table if not exists public.study_clinic (
  id text primary key,
  title text not null,
  duration text,
  blurb text,
  video_urls jsonb not null default '[]'::jsonb,
  position integer not null default 0,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.study_clinic enable row level security;

drop policy if exists "students read published study clinic" on public.study_clinic;
create policy "students read published study clinic"
  on public.study_clinic for select
  to authenticated
  using (published = true or public.is_course_staff());

drop policy if exists "staff manage study clinic" on public.study_clinic;
create policy "staff manage study clinic"
  on public.study_clinic for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update, delete on public.study_clinic to authenticated;

insert into public.study_clinic (id, title, duration, blurb, video_urls, position, published, updated_at)
select
  l.id,
  l.title,
  l.duration,
  l.blurb,
  coalesce(l.video_urls, '[]'::jsonb),
  coalesce(l.position, 0),
  true,
  now()
from public.lessons l
left join public.chapters c on c.id = l.chapter_id
where l.type = 'video'
  and (
    l.chapter_id = 'ch11'
    or c.title ~* 'common[[:space:]]+(fixes|challenges)'
    or c.title ~* 'fixes for common'
  )
on conflict (id) do update
set
  title = excluded.title,
  duration = excluded.duration,
  blurb = excluded.blurb,
  video_urls = excluded.video_urls,
  position = excluded.position,
  updated_at = now();

notify pgrst, 'reload schema';
