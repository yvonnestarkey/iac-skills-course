-- Mindset Sandbox plugin diagnostic tool: getEvaluatorAttemptSummary
-- ChatGPT's attached Supabase app calls PostgREST:
--   POST /rest/v1/rpc/getEvaluatorAttemptSummary  {"attempt_id":"<uuid>"}
-- Quoted camelCase name is required so the plugin tool matches the RPC.
-- Tiny read-only JSON: attempt id, student name, sitting, paper, status, page counts.
-- No page URLs, images, storage paths, or official-source contents.
-- Paste in the Supabase SQL editor. Does not change exam_attempts, uploads,
-- getEvaluatorAttemptEvidence, or student rows.

create or replace function public."getEvaluatorAttemptSummary"(attempt_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.exam_attempts%rowtype;
  profile_name text;
  profile_email text;
  student_name text;
begin
  if attempt_id is null or btrim(attempt_id) = '' then
    return jsonb_build_object('error', 'Missing attempt_id.');
  end if;

  if attempt_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return jsonb_build_object('error', 'That exam attempt was not found.');
  end if;

  select * into rec
  from public.exam_attempts
  where id = attempt_id::uuid;

  if not found then
    return jsonb_build_object('error', 'That exam attempt was not found.');
  end if;

  select nullif(btrim(p.full_name), ''), nullif(btrim(p.email), '')
  into profile_name, profile_email
  from public.profiles p
  where p.id = rec.user_id;

  student_name := coalesce(
    profile_name,
    nullif(initcap(regexp_replace(split_part(coalesce(profile_email, ''), '@', 1), '[._-]+', ' ', 'g')), ''),
    case when rec.source = 'staff_test' then 'Staff test' else 'Unknown student' end
  );

  return jsonb_build_object(
    'attempt_id', rec.id,
    'student_name', student_name,
    'sitting_id', rec.sitting_id,
    'paper_id', rec.paper_id,
    'status', rec.status,
    'bmcr_page_count', (
      select count(*)::int
      from jsonb_array_elements(coalesce(rec.page_images->'bmcr_worksheet', '[]'::jsonb)) elem
      where coalesce(elem->>'url', '') <> ''
        and (elem->>'page') ~ '^[0-9]+$'
    ),
    'exam_script_page_count', (
      select count(*)::int
      from jsonb_array_elements(coalesce(rec.page_images->'marked_script', '[]'::jsonb)) elem
      where coalesce(elem->>'url', '') <> ''
        and (elem->>'page') ~ '^[0-9]+$'
    ),
    'marking_report_page_count', (
      select count(*)::int
      from jsonb_array_elements(coalesce(rec.page_images->'marking_report', '[]'::jsonb)) elem
      where coalesce(elem->>'url', '') <> ''
        and (elem->>'page') ~ '^[0-9]+$'
    )
  );
end;
$$;

comment on function public."getEvaluatorAttemptSummary"(text) is
  'Read-only Mindset Sandbox diagnostic. Returns attempt id, student name, sitting, paper, status, and page counts only.';

revoke all on function public."getEvaluatorAttemptSummary"(text) from public;
grant execute on function public."getEvaluatorAttemptSummary"(text) to anon;
grant execute on function public."getEvaluatorAttemptSummary"(text) to authenticated;
grant execute on function public."getEvaluatorAttemptSummary"(text) to service_role;

notify pgrst, 'reload schema';
