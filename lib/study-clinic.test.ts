import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { findStudyClinicChapter, isStudyClinicVideo, studyClinicVideos } from "./study-clinic";
import type { OutlineChapter } from "./student-lesson";

const outline: OutlineChapter[] = [
  {
    id: "ch10",
    title: "Task 1 - How to evaluate whether you need revision",
    lessons: [{ id: "ch10-l1", title: "Intro", type: "video" }],
  },
  {
    id: "ch11",
    title: "Fixes for Common Student Challenges",
    lessons: [
      { id: "ch11-l1", title: "How to use it", type: "reading" },
      { id: "ch11-l2", title: "Why don't I do questions?", type: "video" },
      { id: "ch11-l3", title: "I'm not studying the way I plan to", type: "video" },
    ],
  },
];

test("Study Clinic pulls video lessons from Common Fixes", () => {
  const chapter = findStudyClinicChapter(outline);
  assert.equal(chapter?.id, "ch11");
  const videos = studyClinicVideos(outline);
  assert.deepEqual(
    videos.map((lesson) => lesson.id),
    ["ch11-l2", "ch11-l3"]
  );
  assert.equal(isStudyClinicVideo(outline, "ch11-l2"), true);
  assert.equal(isStudyClinicVideo(outline, "ch10-l1"), false);
});

test("Study Clinic is in the sidebar and has a full-width video list", () => {
  const nav = readFileSync(resolve("components/student/StudentCourseNav.tsx"), "utf8");
  const page = readFileSync(resolve("components/student/StudyClinic.tsx"), "utf8");
  assert.match(nav, /Study Clinic/);
  assert.match(nav, /\/student\/study-clinic/);
  assert.match(page, /study-clinic-btn/);
  assert.match(page, /studyClinicVideos/);
});
