-- Display-only view of Jan 2027 course access.
-- Authoritative field: public.course_entitlements.status for product_id = 'jan27-iac'.
-- This view does not store or change entitlement, progress, or purchase data.
-- Paste in the Supabase SQL editor.

create or replace view public.student_course_access
with (security_invoker = true) as
select
  p.id as user_id,
  p.email,
  p.full_name,
  p.cohort,
  coalesce(e.status, 'free_preview') as entitlement_status,
  case
    when coalesce(e.status, 'free_preview') = 'full' then 'Full Course'
    else 'Free Preview'
  end as access_label,
  e.source as entitlement_source,
  e.updated_at as entitlement_updated_at,
  p.created_at as profile_created_at
from public.profiles p
left join public.course_entitlements e
  on e.user_id = p.id
 and e.product_id = 'jan27-iac'
where p.role = 'student';

comment on view public.student_course_access is
  'Read-only Jan 2027 access labels derived from course_entitlements.status. Do not treat this view as a second entitlement store.';

grant select on public.student_course_access to authenticated;
