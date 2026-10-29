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

insert into public.courses (id, slug, title, status, product_id, thinkific_url) values
  ('iac-skills', 'iac-skills', 'IAC Skills', 'live', 'jan27-iac', null),
  ('mindset-masterclass', 'mindset-masterclass', 'Mindset Masterclass', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/mindset-masterclass'),
  ('teaching-mindset-skills', 'teaching-mindset-skills', 'Teaching Mindset & Skills', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/growthmindseteducators'),
  ('what-firms-want', 'what-firms-want', 'What firms want you to know', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/trainee-course'),
  ('isa-520-analytical-review', 'isa-520-analytical-review', 'Auditing: ISA520 Analytical Review', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/isa-520-analytical-review'),
  ('navigating-reference-books', 'navigating-reference-books', 'Navigating Reference Books', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/navigating-reference-books'),
  ('audit-risk-and-planning', 'audit-risk-and-planning', 'Audit: Risk and Planning', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/audit-risk-and-planning'),
  ('finalisation-of-the-audit', 'finalisation-of-the-audit', 'Finalisation of the Audit', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/finalisation-of-the-audit'),
  ('auditing-controls', 'auditing-controls', 'Auditing: Controls', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/auditing-controls'),
  ('auditing-substantive-procedures', 'auditing-substantive-procedures', 'Auditing: Substantive Procedures', 'import-ready', null, 'https://courses.accountingstudyadvice.com/courses/auditing-substantive-procedures')
on conflict (id) do update
  set slug = excluded.slug,
      title = excluded.title,
      status = excluded.status,
      product_id = excluded.product_id,
      thinkific_url = excluded.thinkific_url;

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

delete from public.courses
where id in ('cta-skills', 'controls', 'substantive', 'strategy-mindset')
  and not exists (
    select 1 from public.chapters ch
    where ch.course_id = courses.id
  );

notify pgrst, 'reload schema';
