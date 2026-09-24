import test from "node:test";
import assert from "node:assert/strict";
import { checkLessonAccess, catalogFromOutline } from "./accessControl";
import { composeLessonAvailability } from "./lesson-availability";
import { resolvePreviewLessonIds } from "./preview-lessons";
import { applyCourseProgressionGates, type OutlineChapter } from "./student-lesson";
import type { StudentSubmission } from "./student-submissions";
import { hasTask1Submission } from "./task1-gate";

const liveShaped: OutlineChapter[] = [
  {
    id: "ch3",
    title: "S1 - Welcome! How does this course work?",
    lessons: [
      { id: "ch3-l1", title: "Starting early? Here's where to begin...", type: "reading" },
      { id: "ch3-l9", title: "L1 - Course Dates & Details", type: "reading" },
      { id: "ch3-l2", title: "L2 - Is theory costing you the most marks?", type: "video" },
      { id: "ch3-l4", title: "L3 - What's in the course, how does it work?", type: "reading" },
      { id: "ch3-l6", title: "L4 - Previous Students Comments", type: "video" },
    ],
  },
  {
    id: "ch5",
    title: "S2 - What does SAICA / ICAZ / ICAN want you to focus on?",
    lessons: [
      { id: "ch5-l1", title: "L1 - What's up the IAC?", type: "video" },
      { id: "ch5-l2", title: "L2 - What does SAICA say students struggle with?", type: "video" },
      { id: "ch5-l3", title: "L3 - Is your study table falling over?", type: "video" },
      { id: "ch5-l5", title: "L4 - SAICA - IAC Competency Framework", type: "reading" },
      { id: "ch5-l6", title: "L5 - IAC Past Paper Breakdown 2023 - 2026", type: "reading" },
    ],
  },
  {
    id: "ch7",
    title: "S3 - Your New Study Approach",
    lessons: [
      { id: "ch7-l1", title: "L1 - Your new study approach", type: "video" },
      { id: "ch7-l4", title: "L4 - Here's how to do questions to guide your prep", type: "video" },
      { id: "ch7-l5", title: "L5 - How long does it take to improve communication and application?", type: "video" },
    ],
  },
  {
    id: "ch10",
    title: "Task 1 - How to evaluate whether you need revision",
    lessons: [
      { id: "ch10-l1", title: "L1 - What will we cover in Task 1?", type: "reading" },
      { id: "ch10-l-just-3-percent", title: "L2 - Just 3%", type: "video" },
      { id: "ch10-l5", title: "L3 - Why do we avoid questions?", type: "video" },
      { id: "ch10-l7", title: "L8 - Task 1 - Question & Submission", type: "assignment", requires_submission: true },
      { id: "ch10-l9", title: "L9 - Let's talk about the question before you move on...", type: "reading" },
    ],
  },
  {
    id: "ch11",
    title: "Fixes for Common Student Challenges",
    lessons: [
      { id: "ch11-l1", title: "L1 - What you'll find in this section & How to use it", type: "reading" },
      { id: "ch11-l2", title: "Why don't I do questions?", type: "video" },
    ],
  },
  {
    id: "ch12",
    title: "Task 2 - Planning your Case Study & Required",
    lessons: [
      { id: "ch12-l1", title: "L1 - What will we cover in Task 2?", type: "reading" },
      { id: "ch12-l2", title: "L2 - Why Does Case Study Reading Matter?", type: "video" },
      { id: "ch12-l15", title: "L15 - Task 2 - Question & Submission", type: "assignment", requires_submission: true },
    ],
  },
  {
    id: "ch13",
    title: "Task 3 - Discussion Questions",
    lessons: [
      { id: "ch13-l2", title: "L1 - What will we cover in Task 3?", type: "reading" },
      { id: "ch13-l3", title: "L2 - Why Does Communication Cost You Marks?", type: "reading" },
      { id: "ch13-l11", title: "L13 - Task 3: Question & Submission", type: "assignment", requires_submission: true },
    ],
  },
  {
    id: "ch15",
    title: "Task 4 - Strategic Planning vs Subject-matter Expertise",
    lessons: [
      { id: "ch15-l0", title: "Before Task 4 — Have you actually used these?", type: "video" },
      { id: "ch15-l2", title: "L1 - What will we cover in Task 4?", type: "reading" },
      { id: "ch15-l3", title: "L2 - Are you studying TOWARDS your exam?", type: "video" },
      { id: "ch15-l4", title: "L4 - Shift Gears: Strategy vs Subject-matter", type: "video" },
    ],
  },
  {
    id: "ch16",
    title: "Task 5 - Structure & Planning your Answer",
    lessons: [
      { id: "ch16-l1", title: "L1 - What will we cover in Task 5?", type: "reading" },
      { id: "ch16-l2", title: "L2 - 6 Steps to a Better Structure", type: "reading" },
    ],
  },
  {
    id: "ch18",
    title: "Task 6 - Improving Application and Communication",
    lessons: [
      { id: "ch18-l1", title: "L1 - What will we cover in Task 6?", type: "reading" },
      { id: "ch18-l2", title: "L2 - Filing Cabinets vs Toolboxes", type: "video" },
    ],
  },
];

const gated = applyCourseProgressionGates(liveShaped);
const previewIds = resolvePreviewLessonIds(liveShaped);
const catalog = catalogFromOutline(gated);
const none: Record<string, StudentSubmission | undefined> = {};

function view(
  lessonId: string,
  entitlement: "free_preview" | "full",
  submissions: Record<string, StudentSubmission | undefined> = none,
  completed: Record<string, boolean> = {}
) {
  const target = catalog.find((item) => item.id === lessonId);
  assert.ok(target, lessonId);
  const pedagogical = checkLessonAccess(target, catalog, submissions, { completed });
  return composeLessonAvailability({
    commercialCanRead: entitlement === "full" || previewIds.includes(lessonId),
    isPreviewLesson: previewIds.includes(lessonId),
    pedagogical,
  });
}

test("preview IDs resolve from live titles, not an old hardcoded list", () => {
  assert.deepEqual(previewIds, [
    "ch3-l1",
    "ch3-l9",
    "ch3-l2",
    "ch3-l4",
    "ch3-l6",
    "ch5-l1",
    "ch5-l2",
    "ch5-l3",
    "ch5-l5",
    "ch7-l4",
    "ch10-l1",
    "ch10-l-just-3-percent",
    "ch11-l1",
    "ch12-l1",
    "ch13-l2",
    "ch13-l3",
    "ch15-l2",
    "ch15-l3",
    "ch16-l1",
    "ch18-l1",
  ]);
  assert.equal(previewIds.includes("ch5-l6"), false);
  assert.equal(previewIds.includes("ch15-l0"), false);
  assert.equal(previewIds.includes("ch15-l4"), false);
});

test("every configured preview lesson opens for a free account", () => {
  for (const id of previewIds) {
    const result = view(id, "free_preview");
    assert.equal(result.canReadBody, true, id);
    assert.equal(result.layer, "preview", id);
  }
});

test("a late-task preview opens despite progression being locked", () => {
  const result = view("ch15-l2", "free_preview");
  assert.equal(result.canReadBody, true);
  assert.equal(result.layer, "preview");
  const pedagogical = checkLessonAccess(
    catalog.find((item) => item.id === "ch15-l2")!,
    catalog,
    {},
    { completed: {} }
  );
  assert.equal(pedagogical.isLocked, true);
});

test("an adjacent non-preview lesson remains locked for a free account", () => {
  const result = view("ch15-l4", "free_preview");
  assert.equal(result.canReadBody, false);
  assert.equal(result.layer, "purchase");
  assert.equal(view("ch5-l6", "free_preview").layer, "purchase");
  assert.equal(view("ch12-l2", "free_preview").layer, "purchase");
});

test("viewing or completing a preview does not unlock progression", () => {
  const afterPreview = view("ch12-l2", "full", {}, { "ch12-l1": true, "ch15-l2": true, "ch15-l3": true });
  assert.equal(afterPreview.canReadBody, false);
  assert.equal(afterPreview.layer, "progression");
  assert.equal(hasTask1Submission({ "ch12-l1": { body: "watched", link_url: "" } }, gated), false);
});

test("a new paid account can open all Phase 1 and Task 1 learning content", () => {
  for (const id of ["ch3-l1", "ch5-l6", "ch7-l5", "ch10-l1", "ch10-l5", "ch10-l7", "ch10-l9"]) {
    const result = view(id, "full");
    assert.equal(result.canReadBody, true, id);
    assert.notEqual(result.layer, "progression", id);
  }
});

test("Task 2 normal content stays locked for a new paid account while Task 2 preview stays viewable", () => {
  assert.equal(view("ch12-l2", "full").layer, "progression");
  assert.equal(view("ch12-l1", "full").layer, "preview");
  assert.equal(view("ch13-l11", "full").layer, "progression");
  assert.equal(view("ch13-l2", "full").layer, "preview");
});

test("Task 1 assignment submission unlocks Task 2 and the Script Evaluator", () => {
  const submissions = {
    "ch10-l7": { student_id: "s1", lesson_id: "ch10-l7", body: "", link_url: "https://cdn.example/task1.pdf", status: "submitted" as const },
  };
  assert.equal(hasTask1Submission(submissions, gated), true);
  assert.equal(view("ch12-l2", "full", submissions).canReadBody, true);
  assert.equal(view("ch12-l2", "full", submissions).layer, "open");
});

test("later tasks still wait on the previous task assignment after Task 1 is in", () => {
  const afterTask1 = {
    "ch10-l7": { student_id: "s1", lesson_id: "ch10-l7", body: "done", link_url: "", status: "submitted" as const },
  };
  assert.equal(view("ch13-l11", "full", afterTask1).layer, "progression");
  const afterTask2 = {
    ...afterTask1,
    "ch12-l15": { student_id: "s1", lesson_id: "ch12-l15", body: "done", link_url: "", status: "submitted" as const },
  };
  assert.equal(view("ch13-l11", "full", afterTask2).canReadBody, true);
});
