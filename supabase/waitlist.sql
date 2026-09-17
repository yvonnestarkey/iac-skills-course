-- Public waitlist from the sales page on /.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: adds preferred_payment and institution for existing waitlist tables.

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  preferred_cohort text not null,
  preferred_payment text,
  institution text,
  created_at timestamptz not null default now(),
  constraint waitlist_email_key unique (email)
);

alter table public.waitlist add column if not exists preferred_payment text;
alter table public.waitlist add column if not exists institution text;

alter table public.waitlist drop constraint if exists waitlist_cohort_check;
alter table public.waitlist add constraint waitlist_cohort_check
  check (preferred_cohort in ('January 2027 IAC Exam', 'January 2027', 'June 2027'));

alter table public.waitlist drop constraint if exists waitlist_payment_check;
alter table public.waitlist add constraint waitlist_payment_check
  check (
    preferred_payment is null
    or preferred_payment in ('Once-off ($327)', '6 Installments ($60/mo)')
  );

alter table public.waitlist drop constraint if exists waitlist_institution_check;
alter table public.waitlist add constraint waitlist_institution_check
  check (
    institution is null
    or institution in ('SAICA', 'ICAZ', 'ICAN', 'Other')
  );

create index if not exists waitlist_cohort_created_idx
  on public.waitlist (preferred_cohort, created_at desc);

alter table public.waitlist enable row level security;

drop policy if exists "anyone can join waitlist" on public.waitlist;
create policy "anyone can join waitlist"
  on public.waitlist for insert
  to anon, authenticated
  with check (
    char_length(trim(full_name)) > 0
    and char_length(trim(email)) > 2
    and preferred_cohort in ('January 2027 IAC Exam', 'January 2027', 'June 2027')
    and (
      preferred_payment is null
      or preferred_payment in ('Once-off ($327)', '6 Installments ($60/mo)')
    )
    and (
      institution is null
      or institution in ('SAICA', 'ICAZ', 'ICAN', 'Other')
    )
  );

drop policy if exists "staff read waitlist" on public.waitlist;
create policy "staff read waitlist"
  on public.waitlist for select
  to authenticated
  using (public.is_course_staff());

grant select, insert on public.waitlist to authenticated;
grant insert on public.waitlist to anon;

drop function if exists public.join_waitlist(text, text, text);
drop function if exists public.join_waitlist(text, text, text, text);
drop function if exists public.join_waitlist(text, text, text, text, text);

create or replace function public.join_waitlist(
  p_full_name text,
  p_email text,
  p_preferred_cohort text,
  p_preferred_payment text default null,
  p_institution text default null
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

  insert into public.waitlist (full_name, email, preferred_cohort, preferred_payment, institution)
  values (v_name, v_email, p_preferred_cohort, v_payment, v_institution)
  on conflict (email) do update
    set full_name = excluded.full_name,
        preferred_cohort = excluded.preferred_cohort,
        preferred_payment = excluded.preferred_payment,
        institution = excluded.institution;
end;
$$;

revoke all on function public.join_waitlist(text, text, text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text, text, text) to anon, authenticated;
