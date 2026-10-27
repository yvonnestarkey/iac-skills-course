import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  clipFromDraft,
  emptyClinicDraft,
  isRetiredCourseChapter,
  slugifyClinicId,
  withoutRetiredChapters,
} from "./study-clinic";

test("Study Clinic drafts require a title and at least one video URL", () => {
  const draft = emptyClinicDraft();
  draft.title = "Why don't I do questions?";
  draft.videoUrlsText = "https://player.vimeo.com/video/598725555\nhttps://player.vimeo.com/video/598729594";
  const parsed = clipFromDraft(draft);
  assert.ok(parsed.clip);
  assert.equal(parsed.clip?.id, slugifyClinicId(draft.title));
  assert.equal(Array.isArray(parsed.clip?.video_urls) && parsed.clip.video_urls.length, 2);
  assert.equal(clipFromDraft(emptyClinicDraft()).error, "Title is required.");
});

test("the old Common Fixes chapter is retired from the course", () => {
  assert.equal(isRetiredCourseChapter({ id: "ch11", title: "Fixes for Common Student Challenges" }), true);
  assert.equal(isRetiredCourseChapter({ id: "ch-task1", title: "Common Fixes" }), true);
  assert.equal(isRetiredCourseChapter({ id: "ch1", title: "Task 1" }), false);
  assert.deepEqual(
    withoutRetiredChapters([
      { id: "ch1", title: "Task 1" },
      { id: "ch11", title: "Fixes for Common Student Challenges" },
    ]).map((chapter) => chapter.id),
    ["ch1"]
  );
  const sql = readFileSync(resolve("supabase/remove-common-fixes-chapter.sql"), "utf8");
  assert.match(sql, /delete from public.chapters/);
  assert.match(sql, /chapter_id = 'ch11'/);
});

test("Study Clinic is a table, sidebar page, and Tools editor", () => {
  const sql = readFileSync(resolve("supabase/study-clinic.sql"), "utf8");
  const remove = readFileSync(resolve("supabase/study-clinic-remove-from-lessons.sql"), "utf8");
  const nav = readFileSync(resolve("components/student/StudentCourseNav.tsx"), "utf8");
  const page = readFileSync(resolve("components/student/StudyClinic.tsx"), "utf8");
  const tools = readFileSync(resolve("lib/course-tools.ts"), "utf8");
  const manager = readFileSync(resolve("components/coach/StudyClinicManager.tsx"), "utf8");
  assert.match(sql, /create table if not exists public.study_clinic/);
  assert.match(sql, /from public.lessons/);
  assert.match(remove, /delete from public.lessons/);
  assert.match(nav, /Study Clinic/);
  assert.match(page, /\/api\/study-clinic/);
  assert.match(page, /study-clinic-btn/);
  assert.match(tools, /study-clinic/);
  assert.match(manager, /Save Study Clinic video/);
});
