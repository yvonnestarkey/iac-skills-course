-- Waitlist invitation status + coach admin audit.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- Does NOT email anyone. Does NOT process the existing waitlist.
-- Invitation emails are sent only after an explicit Coach action in the portal.

alter table public.waitlist add column if not exists invitation_status text;
alter table public.waitlist add column if not exists invited_at timestamptz;
alter table public.waitlist add column if not exists invited_by uuid;
alter table public.waitlist add column if not exists invited_user_id uuid;
alter table public.waitlist add column if not exists invitation_access text;

update public.waitlist
set invitation_status = 'waiting'
where invitation_status is null;

alter table public.waitlist drop constraint if exists waitlist_invitation_status_check;
alter table public.waitlist add constraint waitlist_invitation_status_check
  check (
    invitation_status is null
    or invitation_status in ('waiting', 'invited', 'existing_account', 'granted')
  );

alter table public.waitlist drop constraint if exists waitlist_invitation_access_check;
alter table public.waitlist add constraint waitlist_invitation_access_check
  check (
    invitation_access is null
    or invitation_access in ('free_preview', 'full_complimentary')
  );

create table if not exists public.course_admin_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  action text not null,
  target_email text,
  target_user_id uuid,
  waitlist_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.course_admin_events enable row level security;

drop policy if exists "staff read admin events" on public.course_admin_events;
create policy "staff read admin events"
  on public.course_admin_events for select
  to authenticated
  using (public.is_course_staff());

grant select on public.course_admin_events to authenticated;
