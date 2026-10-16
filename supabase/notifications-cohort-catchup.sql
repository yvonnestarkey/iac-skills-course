-- Optional columns so cohort announcements can be copied to students who join later.
-- Safe to re-run. The app still catch-up copies from existing announcement rows
-- if these columns are missing.

alter table public.notifications add column if not exists audience text;
alter table public.notifications add column if not exists cohort text;
alter table public.notifications add column if not exists broadcast_id uuid;

create index if not exists notifications_broadcast_idx
  on public.notifications (broadcast_id);

create index if not exists notifications_cohort_kind_idx
  on public.notifications (cohort, kind, created_at desc);
