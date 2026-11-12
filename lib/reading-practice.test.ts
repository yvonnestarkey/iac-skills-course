import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { remainingExercises } from "./reading-drills";
import {
  draftFromExercise,
  emptyPracticeDraft,
  exerciseFromDraft,
  mergePracticePool,
  parseCaseText,
  parseRecallText,
  parseRowsText,
} from "./reading-practice";

test("practice drafts parse case, recall, and mark rows", () => {
  const sections = parseCaseText("## Background\nThe board appointed you.\n\n## Issue\nCash is tight.");
  assert.equal(sections.length, 2);
  assert.equal(sections[0].sentences[0].id, "s1");
  const recall = parseRecallText("Q: What is this?\n* A distressed company\nA bank\n\nQ: Who appointed you?\nThe CEO\n* The board");
  assert.equal(recall.length, 2);
  assert.equal(recall[0].correct, 0);
  assert.equal(recall[1].correct, 1);
  const rows = parseRowsText("r1 | direct | Name the cash problem | s2 | 1\n");
  assert.equal(rows[0].proximity, "direct");
  assert.deepEqual(rows[0].clues, ["s2"]);
});

test("a complete draft becomes a drill exercise and round-trips", () => {
  const draft = emptyPracticeDraft();
  draft.title = "Practice cash case";
  draft.required = "Advise the board on going concern using the case facts.";
  const parsed = exerciseFromDraft(draft);
  assert.ok(parsed.exercise);
  assert.equal(parsed.exercise?.id, "practice-cash-case");
  assert.equal(parsed.exercise?.rtfq.shape.correct, 0);
  const again = exerciseFromDraft(draftFromExercise(parsed.exercise!, true));
  assert.equal(again.exercise?.title, parsed.exercise?.title);
  assert.equal(again.exercise?.required, parsed.exercise?.required);
  assert.equal(remainingExercises([], [parsed.exercise!]).length, 1);
});

test("saved practice questions override built-in drills with the same id", () => {
  const builtIn = exerciseFromDraft({
    ...emptyPracticeDraft(),
    id: "mopane",
    title: "Built-in mopane",
    required: "Advise the board.",
  }).exercise!;
  const extra = exerciseFromDraft({
    ...emptyPracticeDraft(),
    id: "mopane",
    title: "Edited mopane",
    required: "Advise the board.",
  }).exercise!;
  const added = exerciseFromDraft({
    ...emptyPracticeDraft(),
    id: "practice-cash",
    title: "Extra cash case",
    required: "Advise the board.",
  }).exercise!;
  const pool = mergePracticePool([builtIn], [extra, added]);
  assert.equal(pool.length, 2);
  assert.equal(pool[0].title, "Edited mopane");
  assert.equal(pool[1].id, "practice-cash");
});

test("Reading & RTFQ practice is on the dashboard and in the Tools workspace", () => {
  const dashboard = readFileSync(resolve("components/student/StudentDashboard.tsx"), "utf8");
  const block = readFileSync(resolve("components/student/StudentReadingPractice.tsx"), "utf8");
  const nav = readFileSync(resolve("components/student/StudentCourseNav.tsx"), "utf8");
  const hub = readFileSync(resolve("components/reading/ReadingHub.tsx"), "utf8");
  const creator = readFileSync(resolve("app/coach/builder/page.tsx"), "utf8");
  const tools = readFileSync(resolve("app/coach/tools/page.tsx"), "utf8");
  const editor = readFileSync(resolve("app/coach/tools/reading/page.tsx"), "utf8");
  const panel = readFileSync(resolve("components/coach/CourseToolsPanel.tsx"), "utf8");
  const manager = readFileSync(resolve("components/coach/ContentManager.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/reading-practice-exercises.sql"), "utf8");
  const gate = readFileSync(resolve("components/reading/ReadingToolGate.tsx"), "utf8");
  const dashAt = dashboard.indexOf("StudentReadingPractice");
  const evalAt = dashboard.indexOf("/student/evaluator");
  assert.match(dashboard, /StudentReadingPractice/);
  assert.ok(dashAt >= 0 && evalAt > dashAt);
  assert.doesNotMatch(dashboard, /student-hub-card-featured/);
  assert.doesNotMatch(dashboard, /Task2ReadingResults/);
  assert.match(block, /Reading &amp; RTFQ Tool/);
  assert.match(block, /Unlocks after Task 2/);
  assert.match(block, /Practice another one/);
  assert.match(block, /task-complete-stamp/);
  assert.match(block, /hasTask2Submission/);
  assert.doesNotMatch(block, /student-task-dates-featured/);
  assert.match(hub, /Done in Task 2/);
  assert.doesNotMatch(nav, /Reading & RTFQ Tool/);
  assert.match(hub, /mergePracticePool/);
  assert.match(creator, /CourseToolsPanel/);
  assert.match(panel, /title="Tools"/);
  assert.match(panel, /ReadingPracticeManager/);
  assert.match(tools, /COURSE_TOOLS/);
  assert.match(editor, /ReadingPracticeManager/);
  assert.doesNotMatch(manager, /ReadingPracticeManager/);
  assert.match(sql, /reading_practice_exercises/);
  assert.match(gate, /hasTask2Submission/);
});
