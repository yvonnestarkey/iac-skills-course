import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { normalizeLessonWriteRow } from "./content";

test("lesson writes map video_url onto video_urls and drop the missing column", () => {
  const row = normalizeLessonWriteRow({
    id: "ch10-l9",
    title: "New clip",
    video_url: "https://player.vimeo.com/video/1239250910",
    created_at: "2026-10-26T09:00:00Z",
  });
  assert.deepEqual(row.video_urls, ["https://player.vimeo.com/video/1239250910"]);
  assert.equal("video_url" in row, false);
  assert.equal("created_at" in row, false);
});

test("lesson writes leave existing video_urls alone when video_url is empty", () => {
  const row = normalizeLessonWriteRow({
    id: "ch10-l1",
    video_url: null,
    video_urls: ["https://player.vimeo.com/video/1", "https://player.vimeo.com/video/2"],
  });
  assert.deepEqual(row.video_urls, ["https://player.vimeo.com/video/1", "https://player.vimeo.com/video/2"]);
  assert.equal("video_url" in row, false);
});

test("coach lesson saves go through a staff service-role route", () => {
  const route = readFileSync(resolve("app/api/coach/lessons/route.ts"), "utf8");
  const writer = readFileSync(resolve("lib/content.ts"), "utf8");
  const manager = readFileSync(resolve("components/coach/ContentManager.tsx"), "utf8");
  assert.match(route, /isStaffUser/);
  assert.match(route, /getServiceSupabase/);
  assert.match(route, /revalidateTag\("course-outline"\)/);
  assert.match(writer, /\/api\/coach\/lessons/);
  assert.match(writer, /normalizeLessonWriteRow/);
  assert.match(writer, /persistLessonDraftFlags/);
  assert.match(writer, /set_lesson_draft/);
  assert.match(manager, /drip-feed message when students complete this lesson/);
  assert.match(manager, /Save as draft/);
});

test("course outline chapters start collapsed and Up/Down save order", () => {
  const board = readFileSync(resolve("components/coach/CourseOutlineBoard.tsx"), "utf8");
  const manager = readFileSync(resolve("components/coach/ContentManager.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/reorder-chapter-lessons.sql"), "utf8");
  assert.match(board, /<details className="course-outline-chapter"/);
  assert.match(board, /Chapters start closed/);
  assert.doesNotMatch(board, /\bdraggable\b/);
  assert.match(board, /shiftLesson/);
  assert.match(manager, /outline: true/);
  const writer = readFileSync(resolve("lib/content.ts"), "utf8");
  assert.match(writer, /reorder_chapter_lessons/);
  assert.match(sql, /reload schema/);
});

test("draft SQL can set the flag after a lesson save", () => {
  const sql = readFileSync(resolve("supabase/lesson-drafts.sql"), "utf8");
  assert.match(sql, /add column if not exists is_draft/);
  assert.match(sql, /drop function if exists public.list_lesson_catalog/);
  assert.match(sql, /set_lesson_draft/);
  assert.match(sql, /reload schema/);
});
