-- Evolving systems model for Mindset Sandbox.
-- Paste only after architecture review. Does not drop or alter existing tables.
-- Does not store source documents; records reference gateway source IDs.

create table if not exists public.mindset_systems_records (
  id uuid primary key default gen_random_uuid(),
  record_type text not null
    check (record_type in (
      'observation',
      'interpretation',
      'relationship',
      'alternative',
      'question',
      'revision',
      'yvonne_review'
    )),
  epistemic_status text not null
    check (epistemic_status in (
      'source_observation',
      'ai_hypothesis',
      'yvonne_confirmed',
      'yvonne_corrected',
      'research_supported',
      'contested',
      'unresolved_question',
      'superseded'
    )),
  lifecycle text not null default 'active'
    check (lifecycle in ('active', 'superseded', 'withdrawn')),
  title text not null,
  statement text not null default '',
  rationale text not null default '',
  payload jsonb not null default '{}'::jsonb,
  source_refs jsonb not null default '[]'::jsonb,
  supports_record_ids uuid[] not null default '{}',
  challenges_record_ids uuid[] not null default '{}',
  related_record_ids uuid[] not null default '{}',
  supersedes_id uuid references public.mindset_systems_records(id),
  checkpoint_id uuid,
  needs_yvonne_review boolean not null default false,
  created_by text not null default 'ai'
    check (created_by in ('ai', 'yvonne')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists mindset_systems_records_type_lifecycle_idx
  on public.mindset_systems_records (record_type, lifecycle, created_at desc);

create index if not exists mindset_systems_records_status_idx
  on public.mindset_systems_records (epistemic_status, lifecycle);

create table if not exists public.mindset_systems_checkpoints (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  status text not null default 'current'
    check (status in ('current', 'archived')),
  title text not null,
  synthesis text not null default '',
  model jsonb not null default '{}'::jsonb,
  guardrails jsonb not null default '[]'::jsonb,
  supporting_record_ids uuid[] not null default '{}',
  challenging_record_ids uuid[] not null default '{}',
  open_question_ids uuid[] not null default '{}',
  revision_id uuid references public.mindset_systems_records(id),
  replaces_checkpoint_id uuid references public.mindset_systems_checkpoints(id),
  created_by text not null default 'ai'
    check (created_by in ('ai', 'yvonne')),
  created_at timestamptz not null default now()
);

create unique index if not exists mindset_systems_checkpoints_one_current
  on public.mindset_systems_checkpoints (status)
  where status = 'current';

create index if not exists mindset_systems_checkpoints_created_idx
  on public.mindset_systems_checkpoints (created_at desc);

alter table public.mindset_systems_records
  drop constraint if exists mindset_systems_records_checkpoint_id_fkey;
alter table public.mindset_systems_records
  add constraint mindset_systems_records_checkpoint_id_fkey
  foreign key (checkpoint_id) references public.mindset_systems_checkpoints(id);

create table if not exists public.mindset_systems_working_state (
  id uuid primary key default gen_random_uuid(),
  version text not null,
  status text not null default 'current'
    check (status in ('current', 'archived')),
  current_checkpoint_id uuid references public.mindset_systems_checkpoints(id),
  state jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists mindset_systems_working_state_one_current
  on public.mindset_systems_working_state (status)
  where status = 'current';

alter table public.mindset_systems_records enable row level security;
alter table public.mindset_systems_checkpoints enable row level security;
alter table public.mindset_systems_working_state enable row level security;

drop policy if exists "staff read systems records" on public.mindset_systems_records;
create policy "staff read systems records"
  on public.mindset_systems_records for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff read systems checkpoints" on public.mindset_systems_checkpoints;
create policy "staff read systems checkpoints"
  on public.mindset_systems_checkpoints for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff read systems working state" on public.mindset_systems_working_state;
create policy "staff read systems working state"
  on public.mindset_systems_working_state for select
  to authenticated
  using (public.is_course_staff());

grant select on public.mindset_systems_records to authenticated;
grant select on public.mindset_systems_checkpoints to authenticated;
grant select on public.mindset_systems_working_state to authenticated;
grant all on public.mindset_systems_records to service_role;
grant all on public.mindset_systems_checkpoints to service_role;
grant all on public.mindset_systems_working_state to service_role;
