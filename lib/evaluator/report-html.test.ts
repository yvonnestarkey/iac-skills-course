import assert from "node:assert/strict";
import test from "node:test";
import { markdownToHtml, renderReportBody } from "./report-html";

test("headings, labels, lists and paragraphs", () => {
  const html = markdownToHtml("# (Student name) June 2026 Paper 1\n\n## How to read this report\n\nText **bold** and *it*.\n\n## Step 1. RTFQ\n\n### Part I\n\n**Q1(a)**\n\n- one\n- two");
  assert.ok(html.includes("<h1>(Student name) June 2026 Paper 1</h1>"));
  assert.ok(html.includes('<h2 class="how">How to read this report</h2>'));
  assert.ok(html.includes("<h2>Step 1. RTFQ</h2>"));
  assert.ok(html.includes("<h3>Part I</h3>"));
  assert.ok(html.includes('<div class="q"><strong>Q1(a)</strong></div>'));
  assert.ok(html.includes("<ul><li>one</li><li>two</li></ul>"));
  assert.ok(html.includes("<strong>bold</strong>") && html.includes("<em>it</em>"));
});

test("model-written text is escaped, never markup", () => {
  const html = markdownToHtml("| A | B |\n|---|---|\n| <script>alert(1)</script> | x |");
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;"));
});

test("tables shade the reading columns, the marks figures and the Questions attempted row", () => {
  const html = markdownToHtml("| Dimension | Delivered? | Note |\n|---|---|---|\n| Shape | Yes | ok |\n\n| Type | Paper 1 | All three papers |\n|---|---|---|\n| Compliance | 26 of 39 (67%) | **49 of 128 (38%)** |\n\n| Signal | Paper 1 |\n|---|---|\n| Questions attempted | 8 |");
  assert.ok(html.includes('<th class="hl">Delivered?</th>'));
  assert.ok(html.includes('<td class="hl">Yes</td>') && html.includes("<td>ok</td>"));
  assert.ok(html.includes('<td class="hl">26 of 39 (67%)</td>'));
  assert.ok(html.includes('<td class="hl"><strong>49 of 128 (38%)</strong></td>'));
  assert.ok(html.includes('<td class="hl">Questions attempted</td><td class="hl">8</td>'));
  assert.ok(!html.includes('<td class="hl">Shape</td>'));
});

test("one watermark behind all sections, one section per report", () => {
  const body = renderReportBody(["# A", "# B"]);
  assert.equal((body.match(/class="wm"/g) ?? []).length, 1);
  assert.equal((body.match(/<section class="sec">/g) ?? []).length, 2);
});

test("a caption directly above a table is kept with it", () => {
  assert.ok(markdownToHtml("**By pillar** (note)\n\n| A |\n|---|\n| 1 |").includes('<p class="cap">'));
  assert.ok(!markdownToHtml("Plain.\n\nNext paragraph.").includes('class="cap"'));
});
