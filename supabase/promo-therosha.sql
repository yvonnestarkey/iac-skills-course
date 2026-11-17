-- 20% off for Therosha: once-off or the six monthly instalments.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run. The checkout code stays THEROSHA10.

insert into public.promo_codes (code, product_id, percent_off, active)
values ('THEROSHA10', 'jan27-iac', 20, true)
on conflict (code) do update
set product_id = excluded.product_id,
    percent_off = excluded.percent_off,
    active = true;
