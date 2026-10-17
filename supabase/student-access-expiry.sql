-- Coach-managed course expiry and deregistration.
-- Keeps the student profile and entitlement record. Access is denied after
-- deregistered_at is set, or after access_expires_on in SAST.
-- Paste in the Supabase SQL editor.

alter table public.course_entitlements
  add column if not exists access_expires_on date;

alter table public.course_entitlements
  add column if not exists deregistered_at timestamptz;

comment on column public.course_entitlements.access_expires_on is
  'Last SAST calendar day the student may use the course. Null means no scheduled expiry.';

comment on column public.course_entitlements.deregistered_at is
  'When the coach removed course access. The profile and this row stay on file.';
