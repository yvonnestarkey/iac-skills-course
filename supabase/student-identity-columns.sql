-- Student name + email on every table that stores or relates to a student.
-- Paste into the Supabase SQL editor. Safe to re-run.
-- Does not change Auth users, profiles, waitlist, or roster views (those already show name/email).

create or replace function public.lookup_student_identity(p_user_id uuid)
returns table(student_name text, student_email text)
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    nullif(btrim(coalesce(p.full_name, u.raw_user_meta_data ->> 'full_name', '')), '') as student_name,
    lower(nullif(btrim(coalesce(p.email, u.email, '')), '')) as student_email
  from (select p_user_id as id) s
  left join public.profiles p on p.id = s.id
  left join auth.users u on u.id = s.id;
$$;

create or replace function public.fill_student_identity_columns()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  payload jsonb := to_jsonb(NEW);
  uid uuid;
  ident record;
  other record;
  extras jsonb := '{}'::jsonb;
begin
  if payload ? 'student_id' and nullif(payload->>'student_id', '') is not null then
    uid := (payload->>'student_id')::uuid;
  elsif payload ? 'user_id' and nullif(payload->>'user_id', '') is not null then
    uid := (payload->>'user_id')::uuid;
  elsif payload ? 'referee_user_id' and nullif(payload->>'referee_user_id', '') is not null then
    uid := (payload->>'referee_user_id')::uuid;
  elsif payload ? 'target_user_id' and nullif(payload->>'target_user_id', '') is not null then
    uid := (payload->>'target_user_id')::uuid;
  elsif payload ? 'invited_user_id' and nullif(payload->>'invited_user_id', '') is not null then
    uid := (payload->>'invited_user_id')::uuid;
  end if;

  if uid is null and payload ? 'purchase_id' and nullif(payload->>'purchase_id', '') is not null then
    select user_id into uid
    from public.course_purchases
    where id = (payload->>'purchase_id')::uuid;
  end if;

  if uid is null and payload ? 'student_email' and nullif(payload->>'student_email', '') is not null then
    select p.id into uid
    from public.profiles p
    where lower(p.email) = lower(payload->>'student_email')
    limit 1;
  end if;

  if uid is not null then
    select * into ident from public.lookup_student_identity(uid);
    extras := extras || jsonb_build_object(
      'student_name', ident.student_name,
      'student_email', coalesce(ident.student_email, nullif(payload->>'student_email', ''), nullif(payload->>'target_email', ''))
    );
  end if;

  if payload ? 'referrer_user_id' and nullif(payload->>'referrer_user_id', '') is not null then
    select * into other from public.lookup_student_identity((payload->>'referrer_user_id')::uuid);
    extras := extras || jsonb_build_object(
      'referrer_name', other.student_name,
      'referrer_email', other.student_email
    );
  end if;

  if payload ? 'referee_user_id' and nullif(payload->>'referee_user_id', '') is not null then
    select * into other from public.lookup_student_identity((payload->>'referee_user_id')::uuid);
    extras := extras || jsonb_build_object(
      'referee_name', other.student_name,
      'referee_email', other.student_email
    );
  end if;

  if extras <> '{}'::jsonb then
    NEW := jsonb_populate_record(NEW, extras);
  end if;
  return NEW;
end;
$$;

alter table public.assignment_bmcr_evaluations add column if not exists student_name text;
alter table public.assignment_bmcr_evaluations add column if not exists student_email text;
alter table public.case_study_conversion_logs add column if not exists student_name text;
alter table public.case_study_conversion_logs add column if not exists student_email text;
alter table public.course_admin_events add column if not exists student_name text;
alter table public.course_admin_events add column if not exists student_email text;
alter table public.course_entitlements add column if not exists student_name text;
alter table public.course_entitlements add column if not exists student_email text;
alter table public.course_payment_events add column if not exists student_name text;
alter table public.course_payment_events add column if not exists student_email text;
alter table public.course_purchase_installments add column if not exists student_name text;
alter table public.course_purchase_installments add column if not exists student_email text;
alter table public.course_purchases add column if not exists student_name text;
alter table public.course_purchases add column if not exists student_email text;
alter table public.custom_survey_responses add column if not exists student_name text;
alter table public.custom_survey_responses add column if not exists student_email text;
alter table public.exam_attempts add column if not exists student_name text;
alter table public.exam_attempts add column if not exists student_email text;
alter table public.inbox_messages add column if not exists student_name text;
alter table public.lesson_progress add column if not exists student_name text;
alter table public.lesson_progress add column if not exists student_email text;
alter table public.mark_report_uploads add column if not exists student_name text;
alter table public.mark_report_uploads add column if not exists student_email text;
alter table public.notifications add column if not exists student_name text;
alter table public.referral_attributions add column if not exists student_name text;
alter table public.referral_attributions add column if not exists student_email text;
alter table public.referral_attributions add column if not exists referrer_name text;
alter table public.referral_attributions add column if not exists referrer_email text;
alter table public.referral_attributions add column if not exists referee_name text;
alter table public.referral_attributions add column if not exists referee_email text;
alter table public.referral_codes add column if not exists student_name text;
alter table public.referral_codes add column if not exists student_email text;
alter table public.referral_ledger add column if not exists student_name text;
alter table public.referral_ledger add column if not exists student_email text;
alter table public.referral_rewards add column if not exists student_name text;
alter table public.referral_rewards add column if not exists student_email text;
alter table public.referral_rewards add column if not exists referrer_name text;
alter table public.referral_rewards add column if not exists referrer_email text;
alter table public.referral_rewards add column if not exists referee_name text;
alter table public.referral_rewards add column if not exists referee_email text;
alter table public.script_evaluations add column if not exists student_name text;
alter table public.script_evaluations add column if not exists student_email text;
alter table public.student_coaching_sessions add column if not exists student_name text;
alter table public.student_coaching_sessions add column if not exists student_email text;
alter table public.student_notes add column if not exists student_name text;
alter table public.student_notes add column if not exists student_email text;
alter table public.student_profiles add column if not exists student_name text;
alter table public.student_profiles add column if not exists student_email text;
alter table public.student_submissions add column if not exists student_name text;
alter table public.student_submissions add column if not exists student_email text;
alter table public.study_plans add column if not exists student_name text;
alter table public.study_plans add column if not exists student_email text;
alter table public.volume_accuracy_entries add column if not exists student_name text;
alter table public.volume_accuracy_entries add column if not exists student_email text;

create or replace function public.attach_student_identity_trigger(p_table regclass)
returns void
language plpgsql
as $$
declare
  table_name text := (p_table::text);
begin
  execute format('drop trigger if exists fill_student_identity on %s', table_name);
  execute format(
    'create trigger fill_student_identity before insert or update on %s for each row execute procedure public.fill_student_identity_columns()',
    table_name
  );
end;
$$;

select public.attach_student_identity_trigger('public.assignment_bmcr_evaluations');
select public.attach_student_identity_trigger('public.case_study_conversion_logs');
select public.attach_student_identity_trigger('public.course_admin_events');
select public.attach_student_identity_trigger('public.course_entitlements');
select public.attach_student_identity_trigger('public.course_payment_events');
select public.attach_student_identity_trigger('public.course_purchase_installments');
select public.attach_student_identity_trigger('public.course_purchases');
select public.attach_student_identity_trigger('public.custom_survey_responses');
select public.attach_student_identity_trigger('public.exam_attempts');
select public.attach_student_identity_trigger('public.inbox_messages');
select public.attach_student_identity_trigger('public.lesson_progress');
select public.attach_student_identity_trigger('public.mark_report_uploads');
select public.attach_student_identity_trigger('public.notifications');
select public.attach_student_identity_trigger('public.referral_attributions');
select public.attach_student_identity_trigger('public.referral_codes');
select public.attach_student_identity_trigger('public.referral_ledger');
select public.attach_student_identity_trigger('public.referral_rewards');
select public.attach_student_identity_trigger('public.script_evaluations');
select public.attach_student_identity_trigger('public.student_coaching_sessions');
select public.attach_student_identity_trigger('public.student_notes');
select public.attach_student_identity_trigger('public.student_profiles');
select public.attach_student_identity_trigger('public.student_submissions');
select public.attach_student_identity_trigger('public.study_plans');
select public.attach_student_identity_trigger('public.volume_accuracy_entries');

update public.assignment_bmcr_evaluations t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.student_id) i
where t.student_id is not null;

update public.case_study_conversion_logs t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.course_admin_events t
set student_name = i.student_name, student_email = coalesce(i.student_email, t.target_email)
from public.lookup_student_identity(t.target_user_id) i
where t.target_user_id is not null;

update public.course_entitlements t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.course_purchases t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.course_purchase_installments t
set student_name = i.student_name, student_email = i.student_email
from public.course_purchases p
join lateral public.lookup_student_identity(p.user_id) i on true
where t.purchase_id = p.id;

update public.course_payment_events t
set student_name = i.student_name, student_email = i.student_email
from public.course_purchases p
join lateral public.lookup_student_identity(p.user_id) i on true
where t.purchase_id = p.id;

update public.custom_survey_responses t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.student_id) i
where t.student_id is not null;

update public.exam_attempts t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.inbox_messages t
set student_name = i.student_name,
    student_email = coalesce(i.student_email, t.student_email)
from public.lookup_student_identity(t.student_id) i
where t.student_id is not null;

update public.inbox_messages t
set student_name = coalesce(t.student_name, p.full_name)
from public.profiles p
where t.student_id is null
  and t.student_name is null
  and lower(t.student_email) = lower(p.email);

update public.lesson_progress t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.mark_report_uploads t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.notifications t
set student_name = i.student_name,
    student_email = coalesce(i.student_email, t.student_email)
from public.lookup_student_identity(coalesce(t.student_id, t.user_id)) i
where coalesce(t.student_id, t.user_id) is not null;

update public.referral_codes t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.referral_ledger t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.referral_attributions t
set
  student_name = referee.student_name,
  student_email = referee.student_email,
  referee_name = referee.student_name,
  referee_email = referee.student_email,
  referrer_name = referrer.student_name,
  referrer_email = referrer.student_email
from public.lookup_student_identity(t.referee_user_id) referee,
     public.lookup_student_identity(t.referrer_user_id) referrer;

update public.referral_rewards t
set
  student_name = referee.student_name,
  student_email = referee.student_email,
  referee_name = referee.student_name,
  referee_email = referee.student_email,
  referrer_name = referrer.student_name,
  referrer_email = referrer.student_email
from public.lookup_student_identity(t.referee_user_id) referee,
     public.lookup_student_identity(t.referrer_user_id) referrer;

update public.script_evaluations t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.student_coaching_sessions t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.student_id) i;

update public.student_notes t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.student_profiles t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.student_id) i;

update public.student_submissions t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.student_id) i;

update public.study_plans t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

update public.volume_accuracy_entries t
set student_name = i.student_name, student_email = i.student_email
from public.lookup_student_identity(t.user_id) i;

create or replace function public.sync_student_identity_copies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.assignment_bmcr_evaluations set student_name = NEW.full_name, student_email = NEW.email where student_id = NEW.id;
  update public.case_study_conversion_logs set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.course_admin_events set student_name = NEW.full_name, student_email = NEW.email where target_user_id = NEW.id;
  update public.course_entitlements set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.course_purchases set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.custom_survey_responses set student_name = NEW.full_name, student_email = NEW.email where student_id = NEW.id;
  update public.exam_attempts set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.inbox_messages set student_name = NEW.full_name, student_email = coalesce(NEW.email, student_email) where student_id = NEW.id;
  update public.lesson_progress set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.mark_report_uploads set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.notifications
    set student_name = NEW.full_name, student_email = coalesce(NEW.email, student_email)
    where student_id = NEW.id or user_id = NEW.id;
  update public.referral_codes set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.referral_ledger set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.referral_attributions
    set student_name = NEW.full_name, student_email = NEW.email, referee_name = NEW.full_name, referee_email = NEW.email
    where referee_user_id = NEW.id;
  update public.referral_attributions
    set referrer_name = NEW.full_name, referrer_email = NEW.email
    where referrer_user_id = NEW.id;
  update public.referral_rewards
    set student_name = NEW.full_name, student_email = NEW.email, referee_name = NEW.full_name, referee_email = NEW.email
    where referee_user_id = NEW.id;
  update public.referral_rewards
    set referrer_name = NEW.full_name, referrer_email = NEW.email
    where referrer_user_id = NEW.id;
  update public.script_evaluations set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.student_coaching_sessions set student_name = NEW.full_name, student_email = NEW.email where student_id = NEW.id;
  update public.student_notes set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.student_profiles set student_name = NEW.full_name, student_email = NEW.email where student_id = NEW.id;
  update public.student_submissions set student_name = NEW.full_name, student_email = NEW.email where student_id = NEW.id;
  update public.study_plans set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.volume_accuracy_entries set student_name = NEW.full_name, student_email = NEW.email where user_id = NEW.id;
  update public.course_purchase_installments t
    set student_name = NEW.full_name, student_email = NEW.email
    from public.course_purchases p
    where t.purchase_id = p.id and p.user_id = NEW.id;
  update public.course_payment_events t
    set student_name = NEW.full_name, student_email = NEW.email
    from public.course_purchases p
    where t.purchase_id = p.id and p.user_id = NEW.id;
  return NEW;
end;
$$;

drop trigger if exists sync_student_identity_copies on public.profiles;
create trigger sync_student_identity_copies
after insert or update of full_name, email on public.profiles
for each row execute procedure public.sync_student_identity_copies();
