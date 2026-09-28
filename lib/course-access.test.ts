import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { DEFAULT_PRODUCT_ID } from "./commerce";
import {
  courseAccessFromEntitlementStatus,
  courseAccessLabel,
  entitlementsByUserId,
  filterStudentsByCourseAccess,
} from "./course-access";

test("existing Free Preview student displays Free Preview", () => {
  assert.equal(courseAccessFromEntitlementStatus("free_preview"), "free_preview");
  assert.equal(courseAccessLabel("free_preview"), "Free Preview");
});

test("existing paid/full-entitlement student displays Full Course", () => {
  assert.equal(courseAccessFromEntitlementStatus("full"), "full");
  assert.equal(courseAccessLabel("full"), "Full Course");
});

test("upgraded student changes from Preview to Full without duplicate records", () => {
  const rows = [{ user_id: "student-1", product_id: DEFAULT_PRODUCT_ID, status: "free_preview" }];
  const preview = entitlementsByUserId(rows);
  assert.equal(preview.size, 1);
  assert.equal(courseAccessLabel(preview.get("student-1")), "Free Preview");

  rows[0].status = "full";
  const upgraded = entitlementsByUserId(rows);
  assert.equal(upgraded.size, 1);
  assert.equal(courseAccessLabel(upgraded.get("student-1")), "Full Course");
});

test("filtering returns the correct students", () => {
  const students = [
    { id: "a", courseAccess: "free_preview" as const },
    { id: "b", courseAccess: "full" as const },
    { id: "c", courseAccess: "free_preview" as const },
  ];
  assert.deepEqual(
    filterStudentsByCourseAccess(students, "all").map((row) => row.id),
    ["a", "b", "c"]
  );
  assert.deepEqual(
    filterStudentsByCourseAccess(students, "free_preview").map((row) => row.id),
    ["a", "c"]
  );
  assert.deepEqual(
    filterStudentsByCourseAccess(students, "full").map((row) => row.id),
    ["b"]
  );
});

test("coach student report agrees with the Students list", () => {
  const listStatus = courseAccessFromEntitlementStatus("full");
  const profileStatus = courseAccessFromEntitlementStatus("full");
  assert.equal(courseAccessLabel(listStatus), courseAccessLabel(profileStatus));
  assert.equal(courseAccessLabel(undefined), "Free Preview");
});

test("SQL view is derived from course_entitlements.status and does not write a second status", () => {
  const sql = readFileSync(resolve("supabase/student-course-access.sql"), "utf8");
  assert.match(sql, /course_entitlements/);
  assert.match(sql, /create or replace view public\.student_course_access/i);
  assert.doesNotMatch(sql, /insert into|update public\.course_entitlements|alter table public\.course_entitlements/i);
});
