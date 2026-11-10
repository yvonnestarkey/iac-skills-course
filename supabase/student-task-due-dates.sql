-- Student-estimated Task completion dates on the dashboard.
-- Paste into the Supabase SQL editor. Safe to re-run.

create table if not exists public.student_task_due_dates (
  student_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  due_on date,
  updated_at timestamptz not null default now(),
  primary key (student_id, task_id)
);

create table if not exists public.student_task_due_date_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users (id) on delete cascade,
  task_id text not null,
  due_on date,
  previous_due_on date,
  changed_at timestamptz not null default now()
);

create index if not exists student_task_due_date_history_student_idx
  on public.student_task_due_date_history (student_id, task_id, changed_at desc);

alter table public.student_task_due_dates enable row level security;
alter table public.student_task_due_date_history enable row level security;

drop policy if exists "students manage own task due dates" on public.student_task_due_dates;
create policy "students manage own task due dates"
  on public.student_task_due_dates for all
  to authenticated
  using (auth.uid() = student_id)
  with check (auth.uid() = student_id);

drop policy if exists "staff read task due dates" on public.student_task_due_dates;
create policy "staff read task due dates"
  on public.student_task_due_dates for select
  to authenticated
  using (public.is_course_staff());

drop policy if exists "students read own task due date history" on public.student_task_due_date_history;
create policy "students read own task due date history"
  on public.student_task_due_date_history for select
  to authenticated
  using (auth.uid() = student_id);

drop policy if exists "staff read task due date history" on public.student_task_due_date_history;
create policy "staff read task due date history"
  on public.student_task_due_date_history for select
  to authenticated
  using (public.is_course_staff());

create or replace function public.log_student_task_due_date()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into public.student_task_due_date_history (student_id, task_id, due_on, previous_due_on)
    values (NEW.student_id, NEW.task_id, NEW.due_on, null);
  elsif NEW.due_on is distinct from OLD.due_on then
    insert into public.student_task_due_date_history (student_id, task_id, due_on, previous_due_on)
    values (NEW.student_id, NEW.task_id, NEW.due_on, OLD.due_on);
  end if;
  return NEW;
end;
$$;

drop trigger if exists student_task_due_dates_history on public.student_task_due_dates;
create trigger student_task_due_dates_history
  after insert or update of due_on on public.student_task_due_dates
  for each row
  execute procedure public.log_student_task_due_date();

grant select, insert, update, delete on public.student_task_due_dates to authenticated;
grant select on public.student_task_due_date_history to authenticated;

notify pgrst, 'reload schema';
