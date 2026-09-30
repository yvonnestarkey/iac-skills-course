import assert from "node:assert/strict";
import test from "node:test";
import { courseAccessLabel } from "./course-access";
import {
  DEFAULT_ROSTER_COLUMNS,
  ROSTER_COLUMNS,
  matchRosterRule,
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
