import assert from "node:assert/strict";
import { test } from "node:test";
import {
  coachOnboardingHasContent,
  coachStudentProfileForm,
  studentPatchFromCoachForm,
  type CoachStudentProfileForm,
} from "./coach-student-profile";
import type { Student } from "./types";

const skipped: Student = {
  id: "s1",
  name: "eleanorraath.er20",
  email: "eleanorraath.er20@gmail.com",
  cohort: "jan27",
  status: "active",
  onboardingCompleted: false,
  onboardingSkipped: true,
};

const blankForm = (): CoachStudentProfileForm => ({
  firstName: "",
  lastName: "",
  phone: "",
  accountabilityEmail: "",
  writtenExam: "",
  iacAttempts: "",
  country: "",
  institution: "",
  institutionOther: "",
  yearPassed: "",
  ctaAttempts: "",
  struggleAreas: "",
  coachingGoals: "",
  additionalNotes: "",
});

test("coach can save a first name without a surname", () => {
  const form = { ...blankForm(), firstName: "Eleanor" };
  const patch = studentPatchFromCoachForm(skipped, form);
  assert.equal(patch.name, "Eleanor");
  assert.equal(patch.onboardingCompleted, false);
  assert.equal(patch.onboardingSkipped, true);
  assert.equal(coachOnboardingHasContent(form), false);
});

test("coach onboarding details mark a skipped student as completed", () => {
  const form = { ...blankForm(), firstName: "Eleanor", country: "Zimbabwe", struggleAreas: "Time" };
  const patch = studentPatchFromCoachForm(skipped, form);
  assert.equal(patch.name, "Eleanor");
  assert.equal(patch.country, "Zimbabwe");
  assert.equal(patch.struggleAreas, "Time");
  assert.equal(patch.onboardingCompleted, true);
  assert.equal(patch.onboardingSkipped, false);
});

test("unknown CTA institutions are edited as Other", () => {
  const form = coachStudentProfileForm({
    ...skipped,
    name: "Ada Lovelace",
    email: "ada@example.com",
    onboardingCompleted: true,
    onboardingSkipped: false,
    ctaUniversity: "Great Zimbabwe University",
  });
  assert.equal(form.institution, "Other");
  assert.equal(form.institutionOther, "Great Zimbabwe University");
});
