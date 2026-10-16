import assert from "node:assert/strict";
import test from "node:test";
import { courseAccessLabel } from "./course-access";
import {
  DEFAULT_ROSTER_COLUMNS,
  ROSTER_COLUMNS,
  matchRosterRule,
  onboardingSurveyAnswers,
  parseRosterOnboarding,
  rosterColumnLabel,
  rosterRuleValue,
  sanitizeRosterColumns,
} from "./roster";

const preview = {
  name: "Preview Student",
  email: "preview@example.com",
  cohort: "jan-2027",
  courseAccess: "free_preview" as const,
};

const full = {
  name: "Full Student",
  email: "full@example.com",
  cohort: "jan-2027",
  courseAccess: "full" as const,
};

test("student roster includes a Course Access column by default", () => {
  assert.equal(ROSTER_COLUMNS.some((column) => column.id === "courseAccess"), true);
  assert.equal(rosterColumnLabel("courseAccess"), "Course Access");
  assert.equal(DEFAULT_ROSTER_COLUMNS.includes("courseAccess"), true);
  assert.deepEqual(sanitizeRosterColumns(undefined), DEFAULT_ROSTER_COLUMNS);
});

test("roster course access distinguishes full and preview students", () => {
  assert.equal(rosterRuleValue(preview, "courseAccess"), "free_preview");
  assert.equal(rosterRuleValue(full, "courseAccess"), "full");
  assert.equal(courseAccessLabel(preview.courseAccess), "Free Preview");
  assert.equal(courseAccessLabel(full.courseAccess), "Full Course");
  assert.equal(
    matchRosterRule(preview, { id: "r1", field: "courseAccess", operator: "is", values: ["free_preview"] }),
    true
  );
  assert.equal(
    matchRosterRule(full, { id: "r2", field: "courseAccess", operator: "is", values: ["free_preview"] }),
    false
  );
  assert.equal(
    matchRosterRule(full, { id: "r3", field: "courseAccess", operator: "is", values: ["full"] }),
    true
  );
});

test("student profile surveys include onboarding details and background", () => {
  const parsed = parseRosterOnboarding({
    onboarding_completed: true,
    demographics: {
      written_before: true,
      exam_attempts: 2,
      country: "South Africa",
      cta_institution: "UNISA",
      cta_year: 2024,
      cta_attempts: 1,
    },
    qualitative_notes: {
      struggle_areas: "Time on discussion questions",
      coaching_goals: "A repeatable exam process",
      additional_notes: "Works full time",
    },
  });
  const answers = onboardingSurveyAnswers({
    ...parsed,
    phone: "082 000 0000",
    accountabilityEmail: "buddy@example.com",
  });
  assert.equal(answers.find((row) => row.label === "Onboarding")?.value, "Completed");
  assert.equal(answers.find((row) => row.label === "Written the IAC exam before")?.value, "Yes");
  assert.equal(answers.find((row) => row.label === "CTA / PGDA institution")?.value, "UNISA");
  assert.equal(answers.find((row) => row.label === "Where they struggle")?.value, "Time on discussion questions");
  assert.equal(answers.find((row) => row.label === "Additional notes")?.value, "Works full time");
  assert.equal(answers.find((row) => row.label === "Phone")?.value, "082 000 0000");
});

test("student survey page packs onboarding ahead of later surveys", async () => {
  const { studentSurveyPacksFrom } = await import("./student-survey-packs");
  const packs = studentSurveyPacksFrom(
    {
      id: "s1",
      name: "Ada",
      email: "ada@example.com",
      cohort: "jan-2027",
      status: "active",
      onboardingCompleted: true,
      country: "Namibia",
      coachingGoals: "Pass in January",
    },
    [
      {
        survey: {
          id: "sv1",
          title: "Task 1 survey",
          description: "",
          slug: "task-1",
          isActive: true,
          isAssignment: false,
          requiresGrade: false,
          pdfUrl: "",
          questions: [{ id: "q1", type: "short_text", label: "Biggest win", helperText: "", required: false, options: [], resourceUrl: "" }],
          createdAt: "",
          updatedAt: "",
        },
        response: {
          id: "r1",
          surveyId: "sv1",
          studentId: "s1",
          studentName: "Ada",
          studentEmail: "ada@example.com",
          answers: { q1: "Time" },
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
      },
    ]
  );
  assert.equal(packs[0].title, "Onboarding");
  assert.equal(packs[1].title, "Task 1 survey");
  assert.equal(packs[1].answers[0].value, "Time");
});
