-- Reliable lesson reorder for Course creator > Course content.
-- Paste into the Supabase SQL editor. Safe to re-run.

create or replace function public.reorder_chapter_lessons(p_chapter_id text, p_lesson_ids text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
begin
  if auth.role() is distinct from 'service_role' and not public.is_course_staff() then
    raise exception 'Coach access required.';
  end if;

  update public.lessons as lesson
  set position = -10000 - ranked.n
  from (
    select id, row_number() over (order by position, id) as n
    from public.lessons
    where chapter_id = p_chapter_id
  ) as ranked
  where lesson.id = ranked.id;

  if p_lesson_ids is not null then
    for i in 1 .. coalesce(array_length(p_lesson_ids, 1), 0) loop
      update public.lessons
      set chapter_id = p_chapter_id, position = i
      where id = p_lesson_ids[i];
    end loop;
  end if;
end;
$$;

revoke all on function public.reorder_chapter_lessons(text, text[]) from public;
grant execute on function public.reorder_chapter_lessons(text, text[]) to service_role, authenticated;

notify pgrst, 'reload schema';
