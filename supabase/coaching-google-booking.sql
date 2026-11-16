-- Switch 1-on-1 booking from Calendly to Google Appointment Schedule.
-- Paste into the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- Safe to re-run.

update public.coaching_page_config
set calendly_url = 'https://calendar.app.google/2bPLVu1Vdnh7LpMh7',
    updated_at = now()
where id = 1;
