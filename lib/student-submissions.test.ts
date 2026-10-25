import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  assignmentSubmittedNotifySubject,
  lessonStatusToQueue,
  packSubmissionContent,
  shouldNotifyCoachOfLessonSubmission,
  submissionFromRow,
  unpackSubmissionContent,
} from "./student-submissions";

test("live content column stores a PDF URL as link_url", () => {
  const unpacked = unpackSubmissionContent({
    content: "https://example.supabase.co/storage/v1/object/public/course-pdfs/assignment-submissions/abc/Blessing-Task-1.pdf",
  });
  assert.equal(unpacked.body, "");
  assert.match(unpacked.link_url, /Blessing-Task-1\.pdf$/);
});

test("legacy body and link_url columns still unpack", () => {
  const unpacked = unpackSubmissionContent({
    body: "Working notes",
    link_url: "https://example.com/file.pdf",
    content: "ignored when body/link exist",
  });
  assert.equal(unpacked.body, "Working notes");
  assert.equal(unpacked.link_url, "https://example.com/file.pdf");
});

test("pack stores a PDF-only submission as a plain URL", () => {
  assert.equal(packSubmissionContent("", "https://cdn.example/file.pdf"), "https://cdn.example/file.pdf");
});

test("submissionFromRow maps live content into the student form fields", () => {
  const row = submissionFromRow({
    student_id: "s1",
    lesson_id: "ch6-l8",
    content: "https://cdn.example/file.pdf",
    status: "submitted",
    submitted_at: "2026-09-21T15:00:00.000Z",
  });
  assert.equal(row.link_url, "https://cdn.example/file.pdf");
  assert.equal(row.body, "");
  assert.equal(row.updated_at, "2026-09-21T15:00:00.000Z");
});

test("lesson uploads map onto the submissions queue and notify the coach", () => {
  assert.equal(lessonStatusToQueue("submitted"), "submitted");
  assert.equal(lessonStatusToQueue("approved"), "graded");
  assert.equal(lessonStatusToQueue("rejected"), "rejected");
  assert.equal(shouldNotifyCoachOfLessonSubmission("keagan@example.com"), true);
  assert.equal(shouldNotifyCoachOfLessonSubmission("s1@test.com"), false);
  assert.match(assignmentSubmittedNotifySubject("Keagan de Kock", "Task 1"), /Keagan de Kock/);
  const tab = readFileSync(resolve("components/coach/AssignmentsTab.tsx"), "utf8");
  assert.match(tab, /fetchLessonSubmissionsForCoach/);
  const form = readFileSync(resolve("components/student/LessonSubmissionForm.tsx"), "utf8");
  assert.match(form, /\/api\/student\/assignment-submitted/);
});
