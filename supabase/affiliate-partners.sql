-- Professional colleague affiliate codes (Roelien first).
-- Student referral credit stays on referral_codes. Colleague payouts are a record only.
-- Safe to re-run.

create table if not exists public.affiliate_partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  email      text,
  code       text not null unique,
  kind       text not null default 'professional',
  rate_bps   integer not null default 1500,
  payout     text not null default 'external',
  created_at timestamptz not null default now()
);

insert into public.affiliate_partners (id, name, code, kind, rate_bps, payout)
values (
  '8e01e11e-21bd-4270-8c0d-e00000c0de01',
  'Roelien',
  'ROELIENJ21HD27',
  'professional',
  1500,
  'external'
)
on conflict (code) do update
  set name = excluded.name,
      rate_bps = excluded.rate_bps,
      payout = excluded.payout,
      kind = excluded.kind;

alter table public.referral_attributions alter column referrer_user_id drop not null;
alter table public.referral_attributions add column if not exists partner_id uuid references public.affiliate_partners(id);
alter table public.referral_rewards alter column referrer_user_id drop not null;
alter table public.referral_rewards add column if not exists partner_id uuid references public.affiliate_partners(id);
alter table public.referral_rewards add column if not exists payout_kind text;
update public.referral_rewards set payout_kind = 'credit' where payout_kind is null;
alter table public.referral_rewards alter column payout_kind set default 'credit';

alter table public.referral_attributions drop constraint if exists referral_attributions_check;
alter table public.referral_attributions drop constraint if exists referral_attributions_not_self;
alter table public.referral_attributions add constraint referral_attributions_not_self
  check (referrer_user_id is null or referee_user_id <> referrer_user_id);
alter table public.referral_attributions drop constraint if exists referral_attributions_referrer_or_partner;
alter table public.referral_attributions add constraint referral_attributions_referrer_or_partner
  check (referrer_user_id is not null or partner_id is not null);

alter table public.affiliate_partners enable row level security;

drop policy if exists "staff read affiliate partners" on public.affiliate_partners;
create policy "staff read affiliate partners"
  on public.affiliate_partners for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff write affiliate partners" on public.affiliate_partners;
create policy "staff write affiliate partners"
  on public.affiliate_partners for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

grant select, insert, update on public.affiliate_partners to authenticated;
