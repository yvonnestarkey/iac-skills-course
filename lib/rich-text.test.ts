import assert from "node:assert/strict";
import { test } from "node:test";
import { isInternalCourseHref, parseTextMarks, resolveCourseHref, wrapSelectedText } from "./rich-text";
import { readingHeroDuration as heroDuration } from "./lesson-duration";
import { firstLessonWebLink } from "./getLessonPdf";

test("parseTextMarks reads bold, underline, and italic", () => {
  const parts = parseTextMarks("Hello **bold** and __under__ and *tilt*");
  assert.deepEqual(
    parts.map((part) => ({ text: part.text, bold: Boolean(part.bold), underline: Boolean(part.underline), italic: Boolean(part.italic) })),
    [
      { text: "Hello ", bold: false, underline: false, italic: false },
      { text: "bold", bold: true, underline: false, italic: false },
      { text: " and ", bold: false, underline: false, italic: false },
      { text: "under", bold: false, underline: true, italic: false },
      { text: " and ", bold: false, underline: false, italic: false },
      { text: "tilt", bold: false, underline: false, italic: true },
    ]
  );
});

test("wrapSelectedText wraps the current selection", () => {
  const next = wrapSelectedText("Go here now", "**", "**", 3, 7);
  assert.equal(next.next, "Go **here** now");
  assert.equal(next.caretStart, 5);
  assert.equal(next.caretEnd, 9);
});

test("reading hero hides a bare number duration", () => {
  assert.equal(heroDuration("2"), null);
  assert.equal(heroDuration("2 min read"), "2 min read");
  assert.equal(heroDuration(""), null);
});

test("WordPress and other site links keep the host the author pasted", () => {
  assert.equal(
    resolveCourseHref("https://accountingstudyadvice.com/student-testimonials/"),
    "https://accountingstudyadvice.com/student-testimonials/"
  );
  assert.equal(
    resolveCourseHref("https://www.accountingstudyadvice.com/student-testimonials/"),
    "https://www.accountingstudyadvice.com/student-testimonials/"
  );
  assert.equal(
    resolveCourseHref("https://class.accountingstudyadvice.com/auditrisk"),
    "https://class.accountingstudyadvice.com/auditrisk"
  );
  assert.equal(isInternalCourseHref("https://accountingstudyadvice.com/student-testimonials/"), false);
  assert.equal(resolveCourseHref("https://iac.accountingstudyadvice.com/student/overview"), "https://iac.accountingstudyadvice.com/student/overview");
  assert.equal(resolveCourseHref("/lessons/ch3-l1"), "/student/ch3-l1");
  assert.equal(isInternalCourseHref("/student/overview"), true);
});

test("firstLessonWebLink skips PDFs and returns the first page link", () => {
  const link = firstLessonWebLink({
    pdf_url: "https://example.com/file.pdf",
    resource_downloads: [{ url: "https://example.com/file.pdf" }, { url: "https://example.com/form", title: "Open the form" }],
  });
  assert.deepEqual(link, { url: "https://example.com/form", title: "Open the form" });
});
