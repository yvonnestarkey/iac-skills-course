import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { remainingExercises } from "./reading-drills";
import {
  draftFromExercise,
  emptyPracticeDraft,
  exerciseFromDraft,
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

test("Reading & RTFQ practice is on the dashboard, hub, and course creator", () => {
  const dashboard = readFileSync(resolve("components/student/StudentDashboard.tsx"), "utf8");
  const nav = readFileSync(resolve("components/student/StudentCourseNav.tsx"), "utf8");
  const hub = readFileSync(resolve("components/reading/ReadingHub.tsx"), "utf8");
  const creator = readFileSync(resolve("components/coach/ContentManager.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/reading-practice-exercises.sql"), "utf8");
  const gate = readFileSync(resolve("components/reading/ReadingToolGate.tsx"), "utf8");
  assert.match(dashboard, /Reading &amp; RTFQ Tool/);
  assert.match(dashboard, /student-hub-card-featured/);
  assert.match(dashboard, /hasTask2Submission/);
  assert.match(nav, /Reading & RTFQ Tool/);
  assert.match(hub, /EXERCISES/);
  assert.match(creator, /Reading & RTFQ practice/);
  assert.match(creator, /ReadingPracticeManager/);
  assert.match(sql, /reading_practice_exercises/);
  assert.match(gate, /hasTask2Submission/);
});
