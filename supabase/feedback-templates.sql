-- Canned assignment feedback that Yvonne can add to over time.
-- Built-in Task 1–6 replies already appear in the review page without this.
-- Paste into the Supabase SQL editor so "Save as canned" can store new ones.

create table if not exists public.feedback_templates (
  id uuid primary key default gen_random_uuid(),
  group_label text not null default 'General',
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid
);

alter table public.feedback_templates add column if not exists group_label text not null default 'General';
alter table public.feedback_templates add column if not exists title text not null default '';
alter table public.feedback_templates add column if not exists body text not null default '';
alter table public.feedback_templates add column if not exists created_at timestamptz not null default now();
alter table public.feedback_templates add column if not exists updated_at timestamptz not null default now();
alter table public.feedback_templates add column if not exists created_by uuid;

create index if not exists feedback_templates_group_idx
  on public.feedback_templates (group_label, created_at);

alter table public.feedback_templates enable row level security;

drop policy if exists "staff manage feedback templates" on public.feedback_templates;
create policy "staff manage feedback templates"
  on public.feedback_templates for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());
