import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { appendFeedbackEntry, nextFeedbackLog, parseFeedbackLog } from "./feedback-log";

test("plain feedback becomes one log entry and later notes append", () => {
  const multiline = "Tighten the required.\n\nTag the bleed on the next script.";
  assert.deepEqual(parseFeedbackLog(multiline), [{ at: "", text: multiline }]);
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
  const log = readFileSync(resolve("components/feedback/FeedbackLog.tsx"), "utf8");
  const css = readFileSync(resolve("app/globals.css"), "utf8");
  assert.match(review, /Comments/);
  assert.match(review, /setFeedback\(""\)/);
  assert.match(review, /Change status/);
  assert.match(review, /Add notes/);
  assert.match(profile, /Hide feedback/);
  assert.match(profile, /aria-expanded/);
  assert.match(profile, /lessonQueuePath/);
  assert.match(log, /feedback-log-body/);
  assert.doesNotMatch(log, /Earlier feedback/);
  assert.match(css, /white-space:\s*pre-wrap/);
});
