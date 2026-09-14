-- Help copy for in-app tooltips.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).

create table if not exists public.help_content (
  key text primary key,
  title text not null,
  description text not null default '',
  video_url text,
  updated_at timestamptz not null default now()
);

alter table public.help_content enable row level security;

drop policy if exists "anyone can read help content" on public.help_content;
create policy "anyone can read help content"
  on public.help_content for select
  to authenticated
  using (true);

insert into public.help_content (key, title, description, video_url)
values
  (
    'phone_number_info',
    'Phone number',
    'Add your number with the country code (for example +27 82 123 4567). We use it if we need to reach you quickly about coaching or your exam plan. You can leave this blank.',
    null
  ),
  (
    'accountability_email_info',
    'Accountability email',
    'This is someone who will nudge you when you stall — a partner, parent, colleague, or friend. We can copy them on reminders. You can leave this blank.',
    null
  )
on conflict (key) do update
set
  title = excluded.title,
  description = excluded.description,
  updated_at = now();
