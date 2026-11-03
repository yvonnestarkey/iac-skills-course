import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { sanitizeStudentPdfName, studentPdfStoragePath } from "./student-pdfs";

test("student PDF names stay safe for storage", () => {
  assert.equal(sanitizeStudentPdfName("Task 2 extra.pdf"), "Task-2-extra.pdf");
  assert.equal(sanitizeStudentPdfName("notes"), "notes.pdf");
  assert.match(studentPdfStoragePath("abc-123", "Hi there.pdf", 99), /^student-files\/abc-123\/99-Hi-there\.pdf$/);
});

test("coach profile has a PDF repository and staff-only SQL", () => {
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const panel = readFileSync(resolve("components/coach/StudentPdfsPanel.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/student-pdfs.sql"), "utf8");
  assert.match(profile, /StudentPdfsPanel/);
  assert.match(panel, /PDF repository/);
  assert.match(sql, /student_pdfs/);
  assert.match(sql, /is_course_staff/);
});
