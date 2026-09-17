-- AI diagnostic engine: vector knowledge base + saved script evaluations.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Requires the pgvector extension (Database → Extensions → vector).

create extension if not exists vector;

create table if not exists public.knowledge_base (
  id uuid primary key default gen_random_uuid(),
  document_title text not null,
  category text not null default 'examiner_report',
  content text not null,
  embedding vector(1536),
  created_at timestamptz not null default now()
);

create index if not exists knowledge_base_category_idx
  on public.knowledge_base (category);

create index if not exists knowledge_base_embedding_idx
  on public.knowledge_base
  using hnsw (embedding vector_cosine_ops);

alter table public.knowledge_base enable row level security;

drop policy if exists "staff read knowledge base" on public.knowledge_base;
create policy "staff read knowledge base"
  on public.knowledge_base for select
  to authenticated
  using (public.is_course_staff());

grant select on public.knowledge_base to authenticated;

create or replace function public.match_knowledge_base(
  query_embedding vector(1536),
  match_count integer default 5,
  filter_category text default null
)
returns table (
  id uuid,
  document_title text,
  category text,
  content text,
  similarity double precision
)
language sql
stable
security definer
set search_path = public
as $$
  select
    kb.id,
    kb.document_title,
    kb.category,
    kb.content,
    (1 - (kb.embedding <=> query_embedding))::double precision as similarity
  from public.knowledge_base kb
  where kb.embedding is not null
    and (filter_category is null or kb.category = filter_category)
  order by kb.embedding <=> query_embedding
  limit greatest(1, least(coalesce(match_count, 5), 20));
$$;

revoke all on function public.match_knowledge_base(vector, integer, text) from public;
grant execute on function public.match_knowledge_base(vector, integer, text) to service_role;

create table if not exists public.script_evaluations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  paper_name text not null,
  question_code text not null,
  tier1_earned numeric not null default 0,
  tier1_available numeric not null default 0,
  tier2_earned numeric not null default 0,
  tier2_available numeric not null default 0,
  student_notes text not null default '',
  knowledge_summary text not null default '',
  application_summary text not null default '',
  dropped_marks_breakdown jsonb not null default '[]'::jsonb,
  coaching_recommendation jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists script_evaluations_user_created_idx
  on public.script_evaluations (user_id, created_at desc);

alter table public.script_evaluations enable row level security;

drop policy if exists "students read own script evaluations" on public.script_evaluations;
create policy "students read own script evaluations"
  on public.script_evaluations for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "students insert own script evaluations" on public.script_evaluations;
create policy "students insert own script evaluations"
  on public.script_evaluations for insert
  to authenticated
  with check (auth.uid() = user_id);

grant select, insert on public.script_evaluations to authenticated;
