import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { isStudentUploadPath, parseCourseStorageRef, protectLessonResourceFields, resolvedTeachingUrl } from "./lesson-assets";

test("lesson loaders keep stored teaching files for paid students", () => {
  const page = readFileSync(resolve("lib/courseData.ts"), "utf8");
  const api = readFileSync(resolve("app/api/student/lessons/[lessonId]/route.ts"), "utf8");
  assert.match(page, /keepStoredTeachingUrls: content\.keepStoredTeachingUrls/);
  assert.match(api, /keepStoredTeachingUrls: commercial\.keepStoredTeachingUrls/);
  assert.equal(page.includes("keepStoredTeachingUrls: content.preview"), false);
  assert.equal(api.includes("keepStoredTeachingUrls: commercial.preview"), false);
});

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

test("paid students keep every stored PDF and download on an open lesson", async () => {
  const stored = "https://example.supabase.co/storage/v1/object/public/course-pdfs/ch5-l6.pdf";
  const kept = await protectLessonResourceFields(
    {
      id: "ch5-l6",
      pdf_url: stored,
      resource_downloads: [{ url: "https://example.supabase.co/storage/v1/object/public/course-pdfs/index.pdf" }],
      body: ["Breakdown"],
    },
    { canRead: true, keepStoredTeachingUrls: true }
  );
  assert.equal(kept.pdf_url, stored);
  assert.deepEqual(kept.resource_downloads, [{ url: "https://example.supabase.co/storage/v1/object/public/course-pdfs/index.pdf" }]);
  assert.deepEqual(kept.body, ["Breakdown"]);

  const fromDownloads = await protectLessonResourceFields(
    { id: "ch5-l7", pdf_url: null, resource_downloads: ["https://cdn.example.com/ethics.pdf"] },
    { canRead: true, keepStoredTeachingUrls: true }
  );
  assert.equal(fromDownloads.pdf_url, "https://cdn.example.com/ethics.pdf");

  const locked = await protectLessonResourceFields(
    { id: "ch12-l2", pdf_url: stored, body: ["secret"] },
    { canRead: false, keepStoredTeachingUrls: true }
  );
  assert.equal(locked.pdf_url, null);
  assert.deepEqual(locked.body, []);
});

test("a student who can read the lesson still gets the PDF if private signing fails", () => {
  const stored = "https://example.supabase.co/storage/v1/object/public/course-pdfs/ch5-l6.pdf";
  assert.equal(
    resolvedTeachingUrl({ url: stored, canRead: true, keepStoredUrl: false, signedUrl: null }),
    stored
  );
  assert.equal(
    resolvedTeachingUrl({
      url: stored,
      canRead: true,
      keepStoredUrl: false,
      signedUrl: "https://example.supabase.co/storage/v1/object/sign/course-teaching/ch5-l6.pdf?token=ok",
    }),
    "https://example.supabase.co/storage/v1/object/sign/course-teaching/ch5-l6.pdf?token=ok"
  );
  assert.equal(resolvedTeachingUrl({ url: stored, canRead: false, keepStoredUrl: false, signedUrl: null }), null);
  assert.equal(resolvedTeachingUrl({ url: stored, canRead: true, keepStoredUrl: true, signedUrl: null }), stored);
});

test("student upload prefixes stay on the public course-pdfs bucket", () => {
  assert.equal(isStudentUploadPath("assignment-submissions/abc/Task-1.pdf"), true);
  assert.equal(isStudentUploadPath("exam-attempts/abc/page-1.jpg"), true);
  assert.equal(isStudentUploadPath("survey-responses/s1/u1/file.pdf"), true);
  assert.equal(isStudentUploadPath("task-1.pdf"), false);
});
