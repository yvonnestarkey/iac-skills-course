import assert from "node:assert/strict";
import { test } from "node:test";
import { missingPages } from "./exam-analysis-pages";
import { PDF_PAGE_RENDER_LIMIT } from "./pdf-page-limit";

test("full-sitting scripts are within the render ceiling", () => {
  assert.ok(PDF_PAGE_RENDER_LIMIT >= 80);
  assert.ok(PDF_PAGE_RENDER_LIMIT >= 56);
});

test("missingPages lists only unimaged PDF pages", () => {
  assert.deepEqual(
    missingPages(56, Array.from({ length: 40 }, (_, index) => ({ page: index + 1 }))),
    Array.from({ length: 16 }, (_, index) => index + 41)
  );
  assert.deepEqual(missingPages(6, [{ page: 1 }, { page: 2 }, { page: 3 }, { page: 4 }, { page: 5 }, { page: 6 }]), []);
});
