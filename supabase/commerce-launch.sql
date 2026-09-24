-- Jan 2027 commercial launch: entitlements, preview, payments, referrals, tighter RLS.
-- Paste into the Supabase SQL editor. Does not drop student/course data.
-- Do not use profiles.cohort as proof of purchase.

create table if not exists public.course_products (
  id text primary key,
  slug text not null unique,
  title text not null,
  currency text not null default 'usd',
  once_off_amount_cents integer not null default 32700,
  plan_amount_cents integer not null default 6000,
  plan_count integer not null default 6,
  zar_once_off_caption text not null default 'approximately R5,400',
  zar_plan_caption text not null default 'approximately R980/month',
  referral_referee_bps integer not null default 500,
  referral_referrer_bps integer not null default 1000,
  locked_lesson_message text not null default 'This lesson is part of the full Jan 2027 IAC course.',
  buy_cta_label text not null default 'Buy full course',
  referral_share_blurb text not null default 'Your friend receives 5% off. You earn 10% course credit after their qualifying payment.',
  stripe_once_off_price_id text,
  stripe_plan_price_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.course_products (id, slug, title)
values ('jan27-iac', 'jan27-iac', 'January 2027 IAC Skills Course')
on conflict (id) do nothing;

create table if not exists public.course_preview_lessons (
  product_id text not null references public.course_products(id) on delete cascade,
  lesson_id text not null,
  sort integer not null default 0,
  primary key (product_id, lesson_id)
);

-- Preview set resolved from live Jan 2027 titles (S1 all; S2 L1-L4; S3 L4; Task 1 L1-L2; Fixes L1; Task 2 L1; Task 3 L1-L2; Task 4 L1-L2; Task 5 L1; Task 6 L1).
insert into public.course_preview_lessons (product_id, lesson_id, sort) values
  ('jan27-iac', 'ch3-l1', 10),
  ('jan27-iac', 'ch3-l9', 20),
  ('jan27-iac', 'ch3-l2', 30),
  ('jan27-iac', 'ch3-l4', 40),
  ('jan27-iac', 'ch3-l6', 50),
  ('jan27-iac', 'ch5-l1', 60),
  ('jan27-iac', 'ch5-l2', 70),
  ('jan27-iac', 'ch5-l3', 80),
  ('jan27-iac', 'ch5-l5', 90),
  ('jan27-iac', 'ch7-l4', 100),
  ('jan27-iac', 'ch10-l1', 110),
  ('jan27-iac', 'ch10-l-just-3-percent', 120),
  ('jan27-iac', 'ch11-l1', 130),
  ('jan27-iac', 'ch12-l1', 140),
  ('jan27-iac', 'ch13-l2', 150),
  ('jan27-iac', 'ch13-l3', 160),
  ('jan27-iac', 'ch15-l2', 170),
  ('jan27-iac', 'ch15-l3', 180),
  ('jan27-iac', 'ch16-l1', 190),
  ('jan27-iac', 'ch18-l1', 200)
on conflict (product_id, lesson_id) do nothing;

create table if not exists public.course_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.course_products(id),
  status text not null check (status in ('free_preview', 'full')),
  source text not null check (source in ('signup', 'stripe', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.course_purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null references public.course_products(id),
  option text not null check (option in ('once_off', 'plan_6')),
  status text not null default 'pending' check (status in ('pending', 'active', 'past_due', 'canceled', 'refunded')),
  stripe_customer_id text,
  stripe_checkout_session_id text unique,
  stripe_subscription_id text,
  stripe_payment_intent_id text,
  successful_installments integer not null default 0,
  last_paid_invoice_id text,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  referral_code_used text,
  promo_code_used text,
  credit_applied_cents integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_payment_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  purchase_id uuid references public.course_purchases(id),
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  referee_user_id uuid primary key references auth.users(id) on delete cascade,
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  code text not null,
  created_at timestamptz not null default now(),
  check (referee_user_id <> referrer_user_id)
);

create table if not exists public.referral_rewards (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referee_user_id uuid not null references auth.users(id) on delete cascade,
  purchase_id uuid references public.course_purchases(id),
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null check (status in ('pending', 'earned', 'applied', 'refund_due', 'refunded', 'reversed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid references public.referral_rewards(id),
  entry_type text not null,
  amount_cents integer not null,
  note text,
  created_at timestamptz not null default now()
);

create table if not exists public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  product_id text not null references public.course_products(id),
  percent_off integer not null check (percent_off > 0 and percent_off <= 100),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create or replace function public.provision_commerce_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_code text;
begin
  insert into public.course_entitlements (user_id, product_id, status, source)
  values (new.id, 'jan27-iac', 'free_preview', 'signup')
  on conflict (user_id, product_id) do nothing;

  generated_code := 'JAN27-' || upper(substr(replace(new.id::text, '-', ''), 1, 8));
  insert into public.referral_codes (user_id, code)
  values (new.id, generated_code)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_profile_provision_commerce on public.profiles;
create trigger on_profile_provision_commerce
  after insert on public.profiles
  for each row execute procedure public.provision_commerce_account();

insert into public.course_entitlements (user_id, product_id, status, source)
select id, 'jan27-iac', 'free_preview', 'signup'
from public.profiles
on conflict (user_id, product_id) do nothing;

insert into public.referral_codes (user_id, code)
select id, 'JAN27-' || upper(substr(replace(id::text, '-', ''), 1, 8))
from public.profiles
on conflict (user_id) do nothing;

alter table public.course_purchases add column if not exists successful_installments integer not null default 0;
alter table public.course_purchases add column if not exists last_paid_invoice_id text;

create table if not exists public.course_staff_emails (
  email text primary key
);

insert into public.course_staff_emails (email) values
  ('coach@accountingstudyadvice.com'),
  ('admin@accountingstudyadvice.com'),
  ('yvonne@accountingstudyadvice.com')
on conflict (email) do nothing;

insert into storage.buckets (id, name, public)
values ('course-teaching', 'course-teaching', false)
on conflict (id) do update set public = excluded.public;

create or replace function public.is_course_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce((auth.jwt() -> 'app_metadata' ->> 'role') in ('coach', 'admin'), false)
    or exists (
      select 1
      from public.course_staff_emails
      where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

revoke all on function public.is_course_staff() from public;
grant execute on function public.is_course_staff() to authenticated;

alter table public.course_staff_emails enable row level security;
revoke insert, update, delete, select on public.course_staff_emails from authenticated, anon;

create or replace function public.list_lesson_catalog()
returns table (
  id text,
  title text,
  "type" text,
  duration text,
  seconds integer,
  chapter_id text,
  "position" integer,
  video_duration_seconds integer,
  estimated_read_minutes integer,
  duration_minutes integer,
  requires_submission boolean,
  requires_coach_approval boolean,
  prereq_lesson_id text,
  unlock_at timestamptz,
  survey_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select
    l.id,
    l.title,
    l.type as "type",
    l.duration,
    l.seconds,
    l.chapter_id,
    l.position as "position",
    l.video_duration_seconds,
    l.estimated_read_minutes,
    l.duration_minutes,
    l.requires_submission,
    l.requires_coach_approval,
    l.prereq_lesson_id,
    l.unlock_at,
    l.survey_id
  from public.lessons l
  order by l.chapter_id, l.position;
$$;

revoke all on function public.list_lesson_catalog() from public;
grant execute on function public.list_lesson_catalog() to authenticated;

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() is distinct from 'service_role' then
      new.role := 'student';
    end if;
    return new;
  end if;
  if new.role is distinct from old.role and auth.role() is distinct from 'service_role' then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role
  before update on public.profiles
  for each row execute procedure public.protect_profile_role();

drop trigger if exists protect_profile_role_insert on public.profiles;
create trigger protect_profile_role_insert
  before insert on public.profiles
  for each row execute procedure public.protect_profile_role();

-- Policy drop/recreate is one transaction so a mid-script failure
-- rolls back instead of leaving lessons/profiles in a deny-all gap.
begin;

alter table public.course_products enable row level security;
alter table public.course_preview_lessons enable row level security;
alter table public.course_entitlements enable row level security;
alter table public.course_purchases enable row level security;
alter table public.course_payment_events enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.referral_ledger enable row level security;
alter table public.promo_codes enable row level security;

drop policy if exists "products readable" on public.course_products;
create policy "products readable"
  on public.course_products for select
  to authenticated
  using (true);

drop policy if exists "preview lessons readable" on public.course_preview_lessons;
create policy "preview lessons readable"
  on public.course_preview_lessons for select
  to authenticated
  using (true);

drop policy if exists "own entitlement read" on public.course_entitlements;
create policy "own entitlement read"
  on public.course_entitlements for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "own purchases read" on public.course_purchases;
create policy "own purchases read"
  on public.course_purchases for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "staff payment events" on public.course_payment_events;
create policy "staff payment events"
  on public.course_payment_events for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "own referral code" on public.referral_codes;
create policy "own referral code"
  on public.referral_codes for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "own referral attribution" on public.referral_attributions;
create policy "own referral attribution"
  on public.referral_attributions for select
  to authenticated
  using (auth.uid() = referee_user_id or auth.uid() = referrer_user_id or public.is_course_staff());

drop policy if exists "own referral rewards" on public.referral_rewards;
create policy "own referral rewards"
  on public.referral_rewards for select
  to authenticated
  using (auth.uid() = referrer_user_id or auth.uid() = referee_user_id or public.is_course_staff());

drop policy if exists "own referral ledger" on public.referral_ledger;
create policy "own referral ledger"
  on public.referral_ledger for select
  to authenticated
  using (auth.uid() = user_id or public.is_course_staff());

drop policy if exists "promo codes readable" on public.promo_codes;
create policy "promo codes readable"
  on public.promo_codes for select
  to authenticated
  using (active = true or public.is_course_staff());

revoke insert, update, delete on public.course_entitlements from authenticated, anon;
revoke insert, update, delete on public.course_purchases from authenticated, anon;
revoke insert, update, delete on public.course_payment_events from authenticated, anon;
revoke insert, update, delete on public.referral_rewards from authenticated, anon;
revoke insert, update, delete on public.referral_ledger from authenticated, anon;
revoke insert, update, delete on public.referral_attributions from authenticated, anon;
revoke insert, update, delete on public.course_products from authenticated, anon;
revoke insert, update, delete on public.course_preview_lessons from authenticated, anon;
revoke insert, update, delete on public.course_staff_emails from authenticated, anon;

drop policy if exists "lessons writable by anon" on public.lessons;
drop policy if exists "lessons readable by students and guests" on public.lessons;
drop policy if exists "lessons readable by anon" on public.lessons;
drop policy if exists "staff manage lessons" on public.lessons;
drop policy if exists "staff read lessons" on public.lessons;
create policy "staff manage lessons"
  on public.lessons for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "chapters writable by anon" on public.chapters;
drop policy if exists "chapters readable by students and guests" on public.chapters;
drop policy if exists "staff manage chapters" on public.chapters;
drop policy if exists "authenticated read chapters" on public.chapters;
create policy "authenticated read chapters"
  on public.chapters for select
  to authenticated
  using (true);
create policy "staff manage chapters"
  on public.chapters for all
  to authenticated
  using (public.is_course_staff())
  with check (public.is_course_staff());

drop policy if exists "progress readable by course users" on public.lesson_progress;

drop policy if exists "profiles readable by course users" on public.profiles;
drop policy if exists "profiles readable by owner" on public.profiles;
drop policy if exists "staff read profiles" on public.profiles;
create policy "profiles readable by owner"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);
create policy "staff read profiles"
  on public.profiles for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "staff manage teaching assets" on storage.objects;
create policy "staff manage teaching assets"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'course-teaching' and public.is_course_staff())
  with check (bucket_id = 'course-teaching' and public.is_course_staff());

do $$
begin
  if to_regclass('public.notifications') is not null then
    execute 'drop policy if exists "authenticated coaches insert notifications" on public.notifications';
    execute 'drop policy if exists "staff read notifications" on public.notifications';
    execute 'drop policy if exists "staff insert notifications" on public.notifications';
    execute $policy$
      create policy "authenticated coaches insert notifications"
        on public.notifications for insert
        to authenticated
        with check (public.is_course_staff())
    $policy$;
    execute $policy$
      create policy "staff read notifications"
        on public.notifications for select
        to authenticated
        using (public.is_course_staff())
    $policy$;
  end if;
end
$$;

commit;
