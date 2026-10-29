import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { SEEDED_FEEDBACK_TEMPLATES } from "./feedback-templates-seed";
import {
  applyCannedResponse,
  suggestedTemplateGroup,
  templatesInGroup,
} from "./feedback-templates";

test("canned responses start from the task and can be stacked", () => {
  assert.equal(suggestedTemplateGroup("L8 - Task 1 - Question & Submission"), "Task 1");
  assert.equal(suggestedTemplateGroup("DIY Task 3"), "Task 3 DIY");
  assert.equal(suggestedTemplateGroup("Task 5 Extra"), "Task 5 Extra");
  assert.ok(templatesInGroup(SEEDED_FEEDBACK_TEMPLATES, "Task 1").some((item) => item.title === "Variances"));
  assert.ok(SEEDED_FEEDBACK_TEMPLATES.some((item) => /numbers don’t ‘speak’/i.test(item.body)));
  assert.equal(applyCannedResponse("", "Hi hi", "replace"), "Hi hi");
  assert.equal(applyCannedResponse("Keep this.", "Add this.", "append"), "Keep this.\n\nAdd this.");
});

test("assignment review uses a full-page document and canned starts", () => {
  const review = readFileSync(resolve("components/coach/SubmissionReview.tsx"), "utf8");
  const picker = readFileSync(resolve("components/coach/CannedResponsePicker.tsx"), "utf8");
  const editor = readFileSync(resolve("components/coach/FeedbackDocument.tsx"), "utf8");
  const css = readFileSync(resolve("app/globals.css"), "utf8");
  const sql = readFileSync(resolve("supabase/feedback-templates.sql"), "utf8");
  assert.match(review, /FeedbackDocument/);
  assert.match(review, /CannedResponsePicker/);
  assert.match(review, /submission-review-stack/);
  assert.doesNotMatch(review, /ComposerBox/);
  assert.match(picker, /Use this/);
  assert.match(picker, /Save canned/);
  assert.match(editor, /feedback-document-page/);
  assert.match(css, /min-height:\s*min\(68vh/);
  assert.match(sql, /feedback_templates/);
});
