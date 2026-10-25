-- Adds the Study Planner walkthrough video to the existing help tooltip.
-- Paste in the Supabase SQL editor. Safe to run more than once.

update public.help_content
set
  video_url = 'https://player.vimeo.com/video/1239250910',
  updated_at = now()
where key = 'study_planner_header_info';
