-- Store the optional waitlist question so you can answer it.
-- Paste into the Supabase SQL editor, then try a signup with a question again.

alter table public.waitlist add column if not exists query text;

drop function if exists public.join_waitlist(text, text, text, text, text);
drop function if exists public.join_waitlist(text, text, text, text, text, text);

create or replace function public.join_waitlist(
  p_full_name text,
  p_email text,
  p_preferred_cohort text,
  p_preferred_payment text default null,
  p_institution text default null,
  p_query text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_full_name);
  v_email text := lower(trim(p_email));
  v_payment text := nullif(trim(coalesce(p_preferred_payment, '')), '');
  v_institution text := nullif(trim(coalesce(p_institution, '')), '');
  v_query text := nullif(trim(coalesce(p_query, '')), '');
begin
  if v_name = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Enter a name and a valid email.';
  end if;
  if p_preferred_cohort not in ('January 2027 IAC Exam', 'January 2027', 'June 2027') then
    raise exception 'Choose the January 2027 IAC Exam.';
  end if;
  if v_payment is not null and v_payment not in ('Once-off ($327)', '6 Installments ($60/mo)') then
    raise exception 'Choose once-off or 6 installments.';
  end if;
  if v_institution is not null and v_institution not in ('SAICA', 'ICAZ', 'ICAN', 'Other') then
    raise exception 'Choose SAICA, ICAZ, ICAN, or Other.';
  end if;
  if v_query is not null and char_length(v_query) > 2000 then
    raise exception 'Keep your question under 2000 characters.';
  end if;

  insert into public.waitlist (full_name, email, preferred_cohort, preferred_payment, institution, query)
  values (v_name, v_email, p_preferred_cohort, v_payment, v_institution, v_query)
  on conflict (email) do update
    set full_name = excluded.full_name,
        preferred_cohort = excluded.preferred_cohort,
        preferred_payment = excluded.preferred_payment,
        institution = excluded.institution,
        query = excluded.query;
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text, text) to anon, authenticated;
