-- Mindset Sandbox plugin tool: getEvaluatorAttemptEvidence
-- ChatGPT's attached Supabase app calls PostgREST:
--   POST /rest/v1/rpc/getEvaluatorAttemptEvidence  {"attempt_id":"<uuid>"}
-- This quoted camelCase name is required. Unquoted Postgres names are lowercased
-- and will not match the plugin tool.
-- Paste in the Supabase SQL editor. Does not change exam_attempts rows, uploads,
-- or official source mappings. Returns stored evidence as JSON text (page_url),
-- not image payloads.

create or replace function public.evaluator_page_group(
  images jsonb,
  group_name text,
  stored_kind text,
  file_name text
)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'group', group_name,
    'stored_kind', stored_kind,
    'name', file_name,
    'page_count', coalesce(jsonb_array_length(grouped.pages), 0),
    'page_numbers', coalesce(
      (
        select jsonb_agg((page->>'page')::int order by (page->>'page')::int)
        from jsonb_array_elements(grouped.pages) page
      ),
      '[]'::jsonb
    ),
    'pages', grouped.pages
  )
  from (
    select coalesce(
      jsonb_agg(
        jsonb_build_object('page', (elem->>'page')::int, 'page_url', elem->>'url')
        order by (elem->>'page')::int
      ),
      '[]'::jsonb
    ) as pages
    from jsonb_array_elements(coalesce(images, '[]'::jsonb)) elem
    where coalesce(elem->>'url', '') <> ''
      and (elem->>'page') ~ '^[0-9]+$'
  ) grouped;
$$;

revoke all on function public.evaluator_page_group(jsonb, text, text, text) from public;
revoke all on function public.evaluator_page_group(jsonb, text, text, text) from anon, authenticated;

create or replace function public."getEvaluatorAttemptEvidence"(attempt_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.exam_attempts%rowtype;
  official jsonb;
  documents jsonb;
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

  official := coalesce(rec.evidence_pack->'official_sources', '{}'::jsonb);
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'kind', doc->>'kind',
        'document_title', coalesce(doc->>'document_title', ''),
        'chunk_count', coalesce((doc->>'chunk_count')::int, 0)
      )
    ),
    '[]'::jsonb
  )
  into documents
  from jsonb_array_elements(coalesce(official->'documents', '[]'::jsonb)) doc;

  return jsonb_build_object(
    'analysed', false,
    'attempt', jsonb_build_object(
      'id', rec.id,
      'user_id', rec.user_id,
      'exam_body', rec.exam_body,
      'sitting_id', rec.sitting_id,
      'sitting_label', rec.sitting_label,
      'paper_id', rec.paper_id,
      'paper_title', rec.paper_title,
      'paper_code', rec.paper_code,
      'status', rec.status
    ),
    'paper', jsonb_build_object(
      'paper_id', rec.paper_id,
      'paper_title', rec.paper_title,
      'paper_code', rec.paper_code,
      'total_marks', 0,
      'requirements', '[]'::jsonb
    ),
    'official_sources', jsonb_build_object(
      'retrieval', coalesce(official->>'retrieval', 'deterministic_title'),
      'complete', coalesce((official->>'complete')::boolean, false),
      'missing', coalesce(official->'missing', '[]'::jsonb),
      'documents', documents
    ),
    'evidence', jsonb_build_object(
      'bmcr', public.evaluator_page_group(
        rec.page_images->'bmcr_worksheet',
        'bmcr',
        'bmcr_worksheet',
        rec.bmcr_worksheet_name
      ),
      'exam_script', public.evaluator_page_group(
        rec.page_images->'marked_script',
        'exam_script',
        'marked_script',
        rec.marked_script_name
      ),
      'marking_report', public.evaluator_page_group(
        rec.page_images->'marking_report',
        'marking_report',
        'marking_report',
        rec.marking_report_name
      )
    )
  );
end;
$$;

comment on function public."getEvaluatorAttemptEvidence"(text) is
  'Read-only Mindset Sandbox plugin tool. Returns stored evaluator evidence as JSON text for one exam attempt. Does not analyse.';

revoke all on function public."getEvaluatorAttemptEvidence"(text) from public;
grant execute on function public."getEvaluatorAttemptEvidence"(text) to anon;
grant execute on function public."getEvaluatorAttemptEvidence"(text) to authenticated;
grant execute on function public."getEvaluatorAttemptEvidence"(text) to service_role;

notify pgrst, 'reload schema';
