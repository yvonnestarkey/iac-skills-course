import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { appendFeedbackEntry, nextFeedbackLog, parseFeedbackLog } from "./feedback-log";

test("plain feedback becomes one log entry and later notes append", () => {
  assert.deepEqual(parseFeedbackLog("Tighten the required."), [{ at: "", text: "Tighten the required." }]);
  const first = appendFeedbackEntry("", { at: "2026-10-25T14:14:00.000Z", text: "Tighten the required." });
  const second = appendFeedbackEntry(first, { at: "2026-11-02T08:02:00.000Z", text: "Better. Tag the bleed." });
  assert.deepEqual(parseFeedbackLog(second), [
    { at: "2026-10-25T14:14:00.000Z", text: "Tighten the required." },
    { at: "2026-11-02T08:02:00.000Z", text: "Better. Tag the bleed." },
  ]);
  assert.equal(nextFeedbackLog(first, { note: "" }), first);
  assert.match(nextFeedbackLog(first, { note: "", statusChanged: true, statusLabel: "Rejected" }), /Status changed to Rejected/);
});

test("coach review logs earlier comments and keeps the composer empty", () => {
  const review = readFileSync(resolve("components/coach/SubmissionReview.tsx"), "utf8");
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  assert.match(review, /Logged feedback/);
  assert.match(review, /setFeedback\(""\)/);
  assert.match(review, /Change status/);
  assert.match(review, /Add notes/);
  assert.match(profile, /reviewed \? "Feedback" : "Review"/);
  assert.match(profile, /lessonQueuePath/);
});
