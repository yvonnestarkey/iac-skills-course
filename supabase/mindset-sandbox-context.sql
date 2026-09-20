-- Mindset Sandbox project/design context.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Does not drop or alter existing tables.

create table if not exists public.mindset_sandbox_context (
  id uuid primary key default gen_random_uuid(),
  context_type text not null
    check (context_type in (
      'project_canon',
      'working_state',
      'key_decisions',
      'open_questions',
      'course_mapping_state'
    )),
  title text not null,
  version text not null,
  status text not null default 'current'
    check (status in ('current', 'archived')),
  content text not null,
  source_filename text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mindset_sandbox_context_type_status_idx
  on public.mindset_sandbox_context (context_type, status, created_at desc);

create unique index if not exists mindset_sandbox_context_one_current
  on public.mindset_sandbox_context (context_type)
  where status = 'current';

alter table public.mindset_sandbox_context enable row level security;

drop policy if exists "staff read mindset sandbox context" on public.mindset_sandbox_context;
create policy "staff read mindset sandbox context"
  on public.mindset_sandbox_context for select
  to authenticated
  using (public.is_course_staff());

grant select on public.mindset_sandbox_context to authenticated;

create or replace function public.replace_mindset_sandbox_context(
  p_context_type text,
  p_title text,
  p_version text,
  p_content text,
  p_source_filename text default null
)
returns public.mindset_sandbox_context
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted public.mindset_sandbox_context;
begin
  if p_content is null or btrim(p_content) = '' then
    raise exception 'content must not be empty';
  end if;

  update public.mindset_sandbox_context
  set status = 'archived', updated_at = now()
  where context_type = p_context_type
    and status = 'current';

  insert into public.mindset_sandbox_context (
    context_type, title, version, status, content, source_filename
  ) values (
    p_context_type,
    p_title,
    p_version,
    'current',
    p_content,
    p_source_filename
  )
  returning * into inserted;

  return inserted;
end;
$$;

revoke all on function public.replace_mindset_sandbox_context(text, text, text, text, text) from public;
grant execute on function public.replace_mindset_sandbox_context(text, text, text, text, text) to service_role;
