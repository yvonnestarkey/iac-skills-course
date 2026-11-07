import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  assignmentSubmittedNotifySubject,
  isLessonQueueId,
  lessonQueuePath,
  lessonStatusToQueue,
  mergeSubmissionFiles,
  packSubmissionContent,
  queueStatusToLesson,
  shouldNotifyCoachOfLessonSubmission,
  submissionFiles,
  submissionFromRow,
  unpackSubmissionContent,
} from "./student-submissions";

test("live content column stores a PDF URL as link_url", () => {
  const unpacked = unpackSubmissionContent({
    content: "https://example.supabase.co/storage/v1/object/public/course-pdfs/assignment-submissions/abc/Blessing-Task-1.pdf",
  });
  assert.equal(unpacked.body, "");
  assert.match(unpacked.link_url, /Blessing-Task-1\.pdf$/);
  assert.equal(unpacked.files.length, 1);
  assert.match(unpacked.files[0].url, /Blessing-Task-1\.pdf$/);
});

test("legacy body and link_url columns still unpack", () => {
  const unpacked = unpackSubmissionContent({
    body: "Working notes",
    link_url: "https://example.com/file.pdf",
    content: "ignored when body/link exist",
  });
  assert.equal(unpacked.body, "Working notes");
  assert.equal(unpacked.link_url, "https://example.com/file.pdf");
  assert.equal(unpacked.files.length, 1);
  assert.equal(unpacked.files[0].url, "https://example.com/file.pdf");
});

test("pack stores a PDF-only submission as a plain URL", () => {
  assert.equal(packSubmissionContent("", "https://cdn.example/file.pdf"), "https://cdn.example/file.pdf");
});

test("extra assignment PDFs are kept instead of overwriting the first", () => {
  const first = { url: "https://cdn.example/task1.pdf", name: "task1.pdf" };
  const extra = { url: "https://cdn.example/workings.pdf", name: "workings.pdf" };
  const packed = packSubmissionContent("", first.url, [first, extra]);
  const unpacked = unpackSubmissionContent({ content: packed });
  assert.equal(unpacked.files.length, 2);
  assert.equal(unpacked.files[0].url, first.url);
  assert.equal(unpacked.files[1].url, extra.url);
  assert.equal(unpacked.link_url, first.url);
  assert.equal(mergeSubmissionFiles([first], extra).length, 2);
  assert.equal(mergeSubmissionFiles([first], first).length, 1);
  assert.deepEqual(
    submissionFiles({ link_url: first.url, files: [first, extra] }).map((file) => file.url),
    [first.url, extra.url]
  );
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
  assert.equal(row.files?.[0]?.url, "https://cdn.example/file.pdf");
  assert.equal(row.body, "");
  assert.equal(row.updated_at, "2026-09-21T15:00:00.000Z");
  assert.equal(row.submitted_at, "2026-09-21T15:00:00.000Z");
});

test("lesson uploads map onto the submissions queue and notify the coach", () => {
  assert.equal(isLessonQueueId("lesson:abc"), true);
  assert.equal(isLessonQueueId("lesson%3Aabc"), true);
  assert.equal(lessonQueuePath("abc"), "/coach/submissions/lesson/abc");
  assert.equal(lessonQueuePath("lesson:abc"), "/coach/submissions/lesson/abc");
  assert.equal(queueStatusToLesson("graded"), "approved");
  const saver = readFileSync(resolve("lib/student-submissions.ts"), "utf8");
  assert.match(saver, /delete payload\[missing\]/);
  assert.match(saver, /updated_at/);
  assert.equal(lessonStatusToQueue("submitted"), "submitted");
  assert.equal(lessonStatusToQueue("approved"), "graded");
  assert.equal(lessonStatusToQueue("rejected"), "rejected");
  assert.equal(shouldNotifyCoachOfLessonSubmission("keagan@example.com"), true);
  assert.equal(shouldNotifyCoachOfLessonSubmission("s1@test.com"), false);
  assert.match(assignmentSubmittedNotifySubject("Keagan de Kock", "Task 1"), /Keagan de Kock/);
  const tab = readFileSync(resolve("components/coach/AssignmentsTab.tsx"), "utf8");
  const review = readFileSync(resolve("components/coach/SubmissionReview.tsx"), "utf8");
  assert.match(tab, /fetchLessonSubmissionsForCoach/);
  assert.match(review, /isLessonQueueId/);
  assert.match(review, /Open student PDF/);
  assert.match(review, /submissionFiles\(lesson\)/);
  assert.match(review, /Comments/);
  assert.match(review, /setFeedback\(""\)/);
  assert.match(saver, /nextFeedbackLog/);
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  assert.match(profile, /Hide feedback/);
  assert.match(profile, /Submitted ·/);
  assert.match(profile, /assignment-submitted-date/);
  assert.match(profile, /submissionFiles\(item\)/);
  const form = readFileSync(resolve("components/student/LessonSubmissionForm.tsx"), "utf8");
  assert.match(form, /\/api\/student\/assignment-submitted/);
  assert.match(form, /Add another PDF/);
  assert.match(form, /multiple/);
  assert.match(form, /mergeSubmissionFiles/);
});
