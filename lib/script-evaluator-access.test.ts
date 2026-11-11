import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import type { CustomSurveyResponse } from "./custom-surveys";
import {
  canOpenScriptEvaluator,
  hasGrassrootsSubmission,
  isGrassrootsSubmissionLesson,
} from "./script-evaluator-access";
import { S4_REPEAT_QUESTION_ID } from "./s4-repeat-gate";
import type { OutlineChapter } from "./student-lesson";

const outline: OutlineChapter[] = [
  {
    id: "ch9",
    title: "S4 - MY Repeat Students - Auditing Paper",
    lessons: [
      { id: "s4-repeat-gate", title: "Have you worked through this IAC Skills Course with Yvonne before?", type: "survey", survey_id: "survey-s4" },
      { id: "ch9-l2", title: "Grassroots: Case study, Required & Solution", type: "upload" },
      { id: "ch9-l3", title: "Grassroots Submission", type: "assignment", requires_submission: true },
      { id: "ch9-l4", title: "Grassroots PDF & Attempt Submission", type: "assignment", requires_submission: true },
    ],
  },
  {
    id: "ch10",
    title: "Task 1 - How to evaluate whether you need revision",
    lessons: [{ id: "ch10-l7", title: "Task 1 - Question & Submission", type: "assignment", requires_submission: true }],
  },
];

function yesReview(): Record<string, CustomSurveyResponse> {
  return {
    "survey-s4": {
      id: "r1",
      surveyId: "survey-s4",
      studentId: "s1",
      studentName: "",
      studentEmail: "",
      answers: { [S4_REPEAT_QUESTION_ID]: "Yes" },
      status: "submitted",
      grade: null,
      feedback: "",
      feedbackFileUrl: "",
      gradedBy: "",
      gradedByName: "",
      gradedAt: "",
      createdAt: "",
      updatedAt: "",
    },
  };
}

test("Grassroots case-study PDF is not a submission; the assignment lessons are", () => {
  assert.equal(isGrassrootsSubmissionLesson({ title: "Grassroots: Case study, Required & Solution", type: "upload" }), false);
  assert.equal(isGrassrootsSubmissionLesson({ title: "Grassroots Submission", type: "assignment" }), true);
  assert.equal(isGrassrootsSubmissionLesson({ title: "Grassroots PDF & Attempt Submission", type: "assignment" }), true);
});

test("Script Evaluator stays locked until Task 1, Grassroots, or a Yes on the S4 question", () => {
  assert.equal(canOpenScriptEvaluator({ submissions: {}, outline }), false);
  assert.equal(
    canOpenScriptEvaluator({ submissions: { "ch10-l7": { body: "", link_url: "https://cdn.example/task1.pdf" } }, outline }),
    true
  );
  assert.equal(
    canOpenScriptEvaluator({ submissions: { "ch9-l3": { body: "attempt", link_url: "" } }, outline }),
    true
  );
  assert.equal(hasGrassrootsSubmission({ "ch9-l2": { body: "pdf", link_url: "" } }, outline), false);
  assert.equal(canOpenScriptEvaluator({ submissions: {}, outline, surveyReviews: yesReview() }), true);
  assert.equal(
    canOpenScriptEvaluator({
      submissions: {},
      outline,
      surveyReviews: {
        "survey-s4": { ...yesReview()["survey-s4"], answers: { [S4_REPEAT_QUESTION_ID]: "No" } },
      },
    }),
    false
  );
});

test("hub and new-attempt screens use the shared Script Evaluator unlock", () => {
  const hub = readFileSync(resolve("components/student/ScriptEvaluatorHub.tsx"), "utf8");
  const create = readFileSync(resolve("components/student/ExamAttemptNew.tsx"), "utf8");
  assert.match(hub, /canOpenScriptEvaluator/);
  assert.match(create, /canOpenScriptEvaluator/);
});
