-- Replace the Jan 2027 free-preview set from the live course titles.
-- Paste in the Supabase SQL editor. Does not change RLS or other commerce objects.

begin;

delete from public.course_preview_lessons
where product_id = 'jan27-iac';

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
  ('jan27-iac', 'ch18-l1', 200);

commit;
