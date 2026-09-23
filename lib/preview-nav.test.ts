import test from "node:test";
import assert from "node:assert/strict";
import { isPurchaseLockedLesson, shouldMarkPreviewNav } from "./preview-nav-state";

test("only free_preview students get preview/lock chrome in course nav", () => {
  assert.equal(shouldMarkPreviewNav("free_preview", false), true);
  assert.equal(shouldMarkPreviewNav("full", false), false);
  assert.equal(shouldMarkPreviewNav("free_preview", true), false);
  assert.equal(shouldMarkPreviewNav(null, false), false);
});

test("paid lessons are purchase-locked from preview ids, not hardcoded titles", () => {
  const preview = new Set(["ch3-l1", "ch4-l1"]);
  assert.equal(isPurchaseLockedLesson("ch3-l1", true, preview), false);
  assert.equal(isPurchaseLockedLesson("ch10-l7", true, preview), true);
  assert.equal(isPurchaseLockedLesson("ch10-l7", false, preview), false);
  assert.equal(isPurchaseLockedLesson("ch3-l1", false, preview), false);
});

test("empty preview ids lock every lesson only while preview chrome is on", () => {
  assert.equal(isPurchaseLockedLesson("ch3-l1", true, []), true);
  assert.equal(isPurchaseLockedLesson("ch3-l1", false, []), false);
});
