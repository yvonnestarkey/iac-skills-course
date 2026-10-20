import assert from "node:assert/strict";
import test from "node:test";
import { courseDisplayName, firstName, reportFileTitle, sittingShortLabel } from "./report-naming";

test("file title: first name, short exam date, Script Evaluation", () => {
  assert.equal(reportFileTitle("S4", "june-2026"), "S4 Jun26 Script Evaluation");
  assert.equal(reportFileTitle("Bryn van der Merwe", "nov-2025"), "Bryn Nov25 Script Evaluation");
  assert.equal(reportFileTitle("", "june-2026"), "Student Jun26 Script Evaluation");
});

test("sitting short label falls back to the label for other ids", () => {
  assert.equal(sittingShortLabel("june-2026"), "Jun26");
  assert.equal(sittingShortLabel("zim-june-2026", "Zimbabwe June 2026"), "Zimbabwe June 2026");
});

test("the course name: profile name, then sign-up name, then the email", () => {
  assert.equal(courseDisplayName({ profileFullName: "Bryn Smith", authFullName: "B", email: "b@x.com" }), "Bryn Smith");
  assert.equal(courseDisplayName({ profileFullName: " ", authFullName: "Bryn", email: "b@x.com" }), "Bryn");
  assert.equal(courseDisplayName({ email: "test.student@x.com" }), "Test Student");
  assert.equal(firstName("Test Student"), "Test");
});
