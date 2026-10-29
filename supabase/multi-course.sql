-- Multi-course LMS: courses table + chapters.course_id.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- Existing IAC Skills chapters default to course_id = 'iac-skills'.
-- Do not insert empty lesson rows for other courses.

create table if not exists public.courses (
  id            text primary key,
  slug          text not null unique,
  title         text not null,
  status        text not null default 'import-ready'
                check (status in ('live', 'import-ready')),
  product_id    text,
  thinkific_url text,
  created_at    timestamptz not null default now()
);

alter table public.courses enable row level security;

drop policy if exists "courses readable by students and guests" on public.courses;
create policy "courses readable by students and guests"
  on public.courses for select
  to anon, authenticated
  using (true);

drop policy if exists "courses writable by anon" on public.courses;
create policy "courses writable by anon"
  on public.courses for all
  to anon, authenticated
  using (true)
  with check (true);

insert into public.courses (id, slug, title, status, product_id) values
  ('iac-skills', 'iac-skills', 'IAC Skills', 'live', 'jan27-iac'),
  ('cta-skills', 'cta-skills', 'CTA Skills', 'import-ready', null),
  ('controls', 'controls', 'Controls', 'import-ready', null),
  ('substantive', 'substantive', 'Substantive Procedures', 'import-ready', null),
  ('strategy-mindset', 'strategy-mindset', 'Strategy & Mindset', 'import-ready', null)
on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      status = excluded.status,
      product_id = excluded.product_id;

alter table public.chapters
  add column if not exists course_id text;

update public.chapters
  set course_id = 'iac-skills'
  where course_id is null;

alter table public.chapters
  alter column course_id set default 'iac-skills';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chapters_course_id_fkey'
  ) then
    alter table public.chapters
      add constraint chapters_course_id_fkey
      foreign key (course_id) references public.courses (id)
      on update cascade;
  end if;
end $$;

create index if not exists chapters_course_id_idx
  on public.chapters (course_id, position);

notify pgrst, 'reload schema';
