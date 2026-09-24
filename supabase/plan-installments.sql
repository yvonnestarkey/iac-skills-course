-- Audit rows for the fixed six-instalment invoicing plan.
-- Paste in the Supabase SQL editor. Does not change Stripe objects or existing purchases.

begin;

create table if not exists public.course_purchase_installments (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.course_purchases(id) on delete cascade,
  installment_number integer not null check (installment_number between 1 and 6),
  amount_cents integer not null,
  currency text not null default 'usd',
  scheduled_at timestamptz not null,
  stripe_invoice_id text,
  stripe_payment_intent_id text,
  status text not null check (status in ('pending', 'draft', 'paid', 'failed', 'void', 'canceled')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (purchase_id, installment_number)
);

create unique index if not exists course_purchase_installments_invoice_uidx
  on public.course_purchase_installments (stripe_invoice_id)
  where stripe_invoice_id is not null;

alter table public.course_purchase_installments enable row level security;

drop policy if exists "own purchase installments read" on public.course_purchase_installments;
create policy "own purchase installments read"
  on public.course_purchase_installments for select
  to authenticated
  using (
    exists (
      select 1
      from public.course_purchases p
      where p.id = purchase_id
        and (p.user_id = auth.uid() or public.is_course_staff())
    )
  );

revoke insert, update, delete on public.course_purchase_installments from authenticated, anon;

commit;
