-- Authoritative student activation signal from Auth, not a second stored boolean.
-- has_password is derived from auth.users.encrypted_password on each read.
-- The function never returns encrypted_password or any other credential.
-- Paste in the Supabase SQL editor. This does not change entitlements or passwords.

create or replace function public.list_student_account_activation()
returns table (
  user_id uuid,
  email text,
  invited_at timestamptz,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  recovery_sent_at timestamptz,
  confirmation_sent_at timestamptz,
  has_password boolean
)
language plpgsql
stable
security definer
set search_path = auth, public
as $$
begin
  -- Service role is used by the staff-gated Next.js coach API.
  -- Authenticated callers still need is_course_staff().
  if auth.role() is distinct from 'service_role' and not public.is_course_staff() then
    raise exception 'not allowed';
  end if;

  return query
  select
    u.id,
    u.email::text,
    u.invited_at,
    u.email_confirmed_at,
    u.last_sign_in_at,
    u.recovery_sent_at,
    u.confirmation_sent_at,
    (coalesce(u.encrypted_password, '') <> '') as has_password
  from auth.users u
  join public.profiles p on p.id = u.id
  where coalesce(p.role, 'student') = 'student';
end;
$$;

comment on function public.list_student_account_activation() is
  'Read-only Auth activation fields for coaches and the service-role coach API. has_password is derived from auth.users; it is not a duplicated entitlement flag. encrypted_password is never returned.';

revoke all on function public.list_student_account_activation() from public;
grant execute on function public.list_student_account_activation() to authenticated;
grant execute on function public.list_student_account_activation() to service_role;
