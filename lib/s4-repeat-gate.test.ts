import assert from "node:assert/strict";
import { test } from "node:test";
import { catalogFromOutline, checkLessonAccess } from "./accessControl";
import { applyCourseProgressionGates, type OutlineChapter } from "./student-lesson";
import { surveyQuestionIsVisible, type CustomSurveyResponse } from "./custom-surveys";
import {
  applyS4RepeatGate,
  S4_NO_MESSAGE,
  S4_REPEAT_GATE_LESSON_ID,
  S4_REPEAT_QUESTION_ID,
  S4_SITTING_QUESTION_ID,
  S4_UNANSWERED_MESSAGE,
  S4_YES,
  s4RepeatAnswer,
  s4RepeatSubmittedMessage,
  s4Task1Href,
} from "./s4-repeat-gate";

const s4: OutlineChapter[] = [
  {
    id: "ch7",
    title: "S4 - Your New Study Approach",
    lessons: [
      {
        id: S4_REPEAT_GATE_LESSON_ID,
        title: "Have you worked through this IAC Skills Course with Yvonne before?",
        type: "survey",
        survey_id: "survey-s4",
      },
      { id: "ch7-l1", title: "L1 - Your new study approach", type: "video" },
      { id: "ch7-l2", title: "L2 - Your Exam is a Game", type: "video" },
    ],
  },
];

function review(answer: string): Record<string, CustomSurveyResponse> {
  return {
    "survey-s4": {
      id: "r1",
      surveyId: "survey-s4",
      studentId: "s1",
      studentName: "",
      studentEmail: "",
      answers: { [S4_REPEAT_QUESTION_ID]: answer },
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

test("S4 follow-on lessons stay locked until the student says they have done the course before", () => {
  const gated = applyS4RepeatGate(s4);
  const catalog = catalogFromOutline(gated);
  const followOn = catalog.find((lesson) => lesson.id === "ch7-l1");
  assert.equal(followOn?.repeat_chapter_gate_id, S4_REPEAT_GATE_LESSON_ID);
  const closed = checkLessonAccess(followOn!, catalog, {}, { outline: gated });
  assert.equal(closed.isLocked, true);
  assert.equal(closed.reason, S4_UNANSWERED_MESSAGE);
  assert.equal(closed.prereqTitle, "L1");
  const declined = checkLessonAccess(followOn!, catalog, {}, { outline: gated, surveyReviews: review("No") });
  assert.equal(declined.isLocked, true);
  assert.equal(declined.reason, S4_NO_MESSAGE);
  assert.equal(declined.prereqTitle, "Task 1 L1");
  assert.equal(declined.prereqLessonId, "ch10-l1");
  const opened = checkLessonAccess(followOn!, catalog, {}, { outline: gated, surveyReviews: review("Yes") });
  assert.equal(opened.isLocked, false);
});

test("the S4 gate lesson itself stays open", () => {
  const gated = applyCourseProgressionGates(s4);
  const catalog = catalogFromOutline(gated);
  const gate = catalog.find((lesson) => lesson.id === S4_REPEAT_GATE_LESSON_ID);
  assert.ok(gate);
  assert.equal(gate?.repeat_chapter_gate_id, undefined);
  assert.equal(checkLessonAccess(gate!, catalog, {}, { outline: gated }).isLocked, false);
});

test("S4 No thank-you copy points students to Task 1", () => {
  assert.equal(s4RepeatAnswer(review("Yes"), s4), "yes");
  assert.equal(s4RepeatAnswer(review("No"), s4), "no");
  assert.equal(s4RepeatSubmittedMessage({ [S4_REPEAT_QUESTION_ID]: "No" }), S4_NO_MESSAGE);
  assert.equal(s4RepeatSubmittedMessage({ [S4_REPEAT_QUESTION_ID]: "Yes" }), null);
  assert.equal(s4Task1Href(), "/student/ch10-l1");
});

test("S4 stays open when L1 is still the study-approach video", () => {
  const videosOnly: OutlineChapter[] = [
    {
      id: "ch7",
      title: "S4 - Your New Study Approach",
      lessons: [
        { id: "ch7-l1", title: "L1 - Your new study approach", type: "video" },
        { id: "ch7-l2", title: "L2 - Your Exam is a Game", type: "video" },
      ],
    },
  ];
  const gated = applyS4RepeatGate(videosOnly);
  const catalog = catalogFromOutline(gated);
  const followOn = catalog.find((lesson) => lesson.id === "ch7-l2");
  assert.equal(followOn?.repeat_chapter_gate_id, undefined);
  assert.equal(checkLessonAccess(followOn!, catalog, {}, { outline: gated }).isLocked, false);
});

test("the sitting question only appears after Yes", () => {
  const sitting = {
    id: S4_SITTING_QUESTION_ID,
    type: "radio" as const,
    label: "Which IAC exam sitting did you register for this course?",
    helperText: "",
    required: true,
    options: [],
    resourceUrl: "",
    visibleWhen: { id: S4_REPEAT_QUESTION_ID, equals: S4_YES },
  };
  assert.equal(surveyQuestionIsVisible(sitting, { [S4_REPEAT_QUESTION_ID]: "No" }), false);
  assert.equal(surveyQuestionIsVisible(sitting, { [S4_REPEAT_QUESTION_ID]: "Yes" }), true);
});
