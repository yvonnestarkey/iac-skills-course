import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TASK_2_ASSIGNMENT_FALLBACK_ID,
  applyTask2ReadingAssignmentPrereqs,
  findTask2Assignment,
  findTask2ReadingLessons,
  hasTask2Submission,
  mergeCompletedWithReading,
  task2AssignmentFromOutline,
  task2MopaneSummary,
  task2ReadingCheckSummary,
} from "./task2-gate";
import type { OutlineChapter } from "./student-lesson";

const outline: OutlineChapter[] = [
  {
    id: "ch12",
    title: "Task 2 - Planning your Case Study & Required",
    lessons: [
      { id: "ch12-l1", title: "Intro", type: "video" },
      { id: "ch12-l15", title: "Task 2 - Question & Submission", type: "assignment", requires_submission: true },
      { id: "ch12-l16", title: "DIY Task 2", type: "assignment" },
    ],
  },
];

test("Task 2 assignment is the Question & Submission lesson, not DIY", () => {
  const found = findTask2Assignment(outline);
  assert.equal(found?.lessonId, "ch12-l15");
  assert.equal(task2AssignmentFromOutline([]).lessonId, TASK_2_ASSIGNMENT_FALLBACK_ID);
});

test("Task 2 assignment waits for the Skimming check and Mopane drill", () => {
  const course: OutlineChapter[] = [
    {
      id: "ch12",
      title: "Task 2 - Planning your Case Study & Required",
      lessons: [
        { id: "ch12-skim", title: "Skimming", type: "reading", tool: "reading-check" },
        { id: "ch12-mopane", title: "Mopane Airlines", type: "reading", tool: "reading-drill:mopane" },
        { id: "ch12-l15", title: "Task 2 - Question & Submission", type: "assignment", requires_submission: true },
      ],
    },
  ];
  const tools = findTask2ReadingLessons(course);
  assert.equal(tools.check?.id, "ch12-skim");
  assert.equal(tools.mopane?.id, "ch12-mopane");
  const gated = applyTask2ReadingAssignmentPrereqs(course);
  assert.deepEqual(
    gated[0].lessons.find((lesson) => lesson.id === "ch12-l15")?.extra_prereq_lesson_ids,
    ["ch12-skim", "ch12-mopane"]
  );
  const done = mergeCompletedWithReading(
    {},
    gated,
    {
      checks: [
        {
          check_id: "reading-check",
          wpm: 142,
          read_sec: 90,
          absorb: 6,
          absorb_n: 10,
          missed: [],
          notes: 3,
          profile: "Skimming",
        },
      ],
      attempts: [
        {
          exercise_id: "mopane",
          wpm: 120,
          read_sec: 80,
          answer_sec: 40,
          total_sec: 120,
          recall: 4,
          recall_n: 5,
          rtfq_read: { shape: 1, dir: 1, lens: 1 },
          rtfq_delivered: { shape: "yes", dir: "yes", lens: "yes" },
          buried_treasure: { dTot: 1, dSpot: 1, iTot: 1, iSpot: 1, dRows: 1, dEarn: 1, iRows: 1, iEarn: 1 },
          rows_earned: [],
          notes: [],
          answer: "",
          fix: "",
          signals: [],
          grade: { pct: 62, potPct: 80 },
          marked_by: "self",
        },
      ],
    }
  );
  assert.equal(done["ch12-skim"], true);
  assert.equal(done["ch12-mopane"], true);
  assert.match(
    task2ReadingCheckSummary({
      check_id: "reading-check",
      wpm: 142,
      read_sec: 90,
      absorb: 6,
      absorb_n: 10,
      missed: [],
      notes: 3,
      profile: "Skimming",
    }),
    /Complete · Skimming/
  );
  assert.equal(task2MopaneSummary({ grade: { pct: 62, potPct: 80 } } as never), "Complete · 62%");
});

test("Reading & RTFQ practice unlocks from the Task 2 submission only", () => {
  assert.equal(hasTask2Submission({}, outline), false);
  assert.equal(hasTask2Submission({ "ch12-l15": { body: "", link_url: "" } }, outline), false);
  assert.equal(
    hasTask2Submission({ "ch12-l15": { body: "", link_url: "https://cdn.example/task2.pdf" } }, outline),
    true
  );
  assert.equal(hasTask2Submission({ "ch12-l16": { body: "DIY notes", link_url: "" } }, outline), false);
});
