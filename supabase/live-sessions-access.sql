-- Live session links: full-course students get Zoom, recordings, and PDFs.
-- Free preview students may only receive the recording URL of the first session
-- (earliest session_at). Paste this in the Supabase SQL editor.

create or replace function public.has_full_course_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_course_staff()
    or exists (
      select 1
      from public.course_entitlements
      where user_id = auth.uid()
        and product_id = 'jan27-iac'
        and status = 'full'
    );
$$;

revoke all on function public.has_full_course_access() from public;
grant execute on function public.has_full_course_access() to authenticated;

drop policy if exists "students read live sessions" on public.live_sessions;
drop policy if exists "full course reads live sessions" on public.live_sessions;
create policy "full course reads live sessions"
  on public.live_sessions for select
  to authenticated
  using (public.has_full_course_access());

create or replace function public.list_live_sessions_for_student()
returns table (
  id uuid,
  title text,
  description text,
  session_at timestamptz,
  status text,
  zoom_url text,
  recording_url text,
  summary_pdf_url text,
  notes_pdf_url text
)
language sql
stable
security definer
set search_path = public
as $$
  with first_session as (
    select x.id
    from public.live_sessions x
    order by x.session_at asc, x.created_at asc, x.id asc
    limit 1
  )
  select
    s.id,
    s.title,
    s.description,
    s.session_at,
    s.status,
    case when public.has_full_course_access() then s.zoom_url else null end,
    case
      when public.has_full_course_access() then s.recording_url
      when s.id = (select first_session.id from first_session) then s.recording_url
      else null
    end,
    case when public.has_full_course_access() then s.summary_pdf_url else null end,
    case when public.has_full_course_access() then s.notes_pdf_url else null end
  from public.live_sessions s
  order by s.session_at asc, s.created_at asc, s.id asc;
$$;

revoke all on function public.list_live_sessions_for_student() from public;
grant execute on function public.list_live_sessions_for_student() to authenticated;
