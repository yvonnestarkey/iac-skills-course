-- Public waitlist from the sales page on /.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  preferred_cohort text not null,
  created_at timestamptz not null default now(),
  constraint waitlist_email_key unique (email),
  constraint waitlist_cohort_check check (preferred_cohort in ('January 2027', 'June 2027'))
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
    and preferred_cohort in ('January 2027', 'June 2027')
  );

drop policy if exists "staff read waitlist" on public.waitlist;
create policy "staff read waitlist"
  on public.waitlist for select
  to authenticated
  using (public.is_course_staff());

grant select, insert on public.waitlist to authenticated;
grant insert on public.waitlist to anon;

create or replace function public.join_waitlist(
  p_full_name text,
  p_email text,
  p_preferred_cohort text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := trim(p_full_name);
  v_email text := lower(trim(p_email));
begin
  if v_name = '' or v_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'Enter a name and a valid email.';
  end if;
  if p_preferred_cohort not in ('January 2027', 'June 2027') then
    raise exception 'Choose January 2027 or June 2027.';
  end if;

  insert into public.waitlist (full_name, email, preferred_cohort)
  values (v_name, v_email, p_preferred_cohort)
  on conflict (email) do update
    set full_name = excluded.full_name,
        preferred_cohort = excluded.preferred_cohort;
end;
$$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;
