-- Variance Bakery lesson in Task 1, immediately after the BMCR Example video (ch10-l2).
-- Paste into the Supabase SQL editor. Safe to re-run.

do $$
declare
  chap text := 'ch10';
  after_id text := 'ch10-l2';
  after_pos integer;
  new_id text;
  n integer := 12;
begin
  select position into after_pos
  from public.lessons
  where id = after_id and chapter_id = chap;

  if after_pos is null then
    raise exception 'Task 1 BMCR video (%) was not found. Add the lesson from the course creator instead.', after_id;
  end if;

  if exists (select 1 from public.lessons where chapter_id = chap and (id = 'ch10-variance-bakery' or title = 'Variance Bakery')) then
    update public.lessons
    set
      title = 'Variance Bakery',
      type = 'reading',
      tool = 'variance-bakery',
      blurb = 'Predict each variance, then check yourself against the bakery staircase.',
      body = '["Variances aren''t formulas to memorise. Each one answers a question about what happened in production. Predict first, then check yourself."]'::jsonb,
      duration = '10 min',
      estimated_read_minutes = 10,
      duration_minutes = 10,
      is_draft = false
    where chapter_id = chap and (id = 'ch10-variance-bakery' or title = 'Variance Bakery');
    return;
  end if;

  loop
    new_id := chap || '-l' || n;
    exit when not exists (select 1 from public.lessons where id = new_id);
    n := n + 1;
  end loop;

  update public.lessons
  set position = position + 1
  where chapter_id = chap and position > after_pos;

  insert into public.lessons (
    id, chapter_id, position, type, title, duration, blurb, body,
    estimated_read_minutes, duration_minutes, tool, is_draft
  ) values (
    new_id,
    chap,
    after_pos + 1,
    'reading',
    'Variance Bakery',
    '10 min',
    'Predict each variance, then check yourself against the bakery staircase.',
    '["Variances aren''t formulas to memorise. Each one answers a question about what happened in production. Predict first, then check yourself."]'::jsonb,
    10,
    10,
    'variance-bakery',
    false
  );
end $$;
