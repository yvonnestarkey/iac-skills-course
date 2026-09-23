import test from "node:test";
import assert from "node:assert/strict";
import { isStudentUploadPath, parseCourseStorageRef } from "./lesson-assets";

test("parseCourseStorageRef reads public and signed teaching URLs", () => {
  assert.deepEqual(
    parseCourseStorageRef("https://example.supabase.co/storage/v1/object/public/course-pdfs/task-1.pdf"),
    { bucket: "course-pdfs", path: "task-1.pdf" }
  );
  assert.deepEqual(
    parseCourseStorageRef("https://example.supabase.co/storage/v1/object/sign/course-teaching/ch10/brief.pdf?token=abc"),
    { bucket: "course-teaching", path: "ch10/brief.pdf" }
  );
  assert.equal(parseCourseStorageRef("https://cdn.thinkific.com/lesson.pdf"), null);
});

test("student upload prefixes stay on the public course-pdfs bucket", () => {
  assert.equal(isStudentUploadPath("assignment-submissions/abc/Task-1.pdf"), true);
  assert.equal(isStudentUploadPath("exam-attempts/abc/page-1.jpg"), true);
  assert.equal(isStudentUploadPath("survey-responses/s1/u1/file.pdf"), true);
  assert.equal(isStudentUploadPath("task-1.pdf"), false);
});
