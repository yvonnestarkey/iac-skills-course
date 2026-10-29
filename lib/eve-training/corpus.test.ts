import { test } from "node:test";
import assert from "node:assert/strict";
import { anonymise, finaliseCorpus, inboxExamples, studentCode, submissionExamples, suggestTags, surveyExamples, toJsonl, toMarkdown } from "./corpus";

const thandi = { id: "u1", email: "thandi.mokoena@gmail.com", full_name: "Thandi Mokoena" };
const people = new Map([["u1", thandi]]);

test("anonymise removes the student's name, emails, phones and links but keeps amounts", () => {
  const out = anonymise("Hi Thandi, see https://x.com/a or mail thandi.mokoena@gmail.com, call 082 123 4567. Mokoena's NPV is R12 000 000.", thandi);
  assert.equal(out, "Hi [student], see [link] or mail [email], call [phone]. [student]'s NPV is R12 000 000.");
});

test("student codes are stable and not the id", () => {
  assert.equal(studentCode("u1"), studentCode("U1"));
  assert.match(studentCode("u1"), /^S-[0-9a-f]{6}$/);
});

test("tags come from the wording", () => {
  assert.deepEqual(suggestTags("You didn't read the question: the required asks for both sides. Use the case facts, more points please."), ["RTFQ", "Buried Treasure", "Volume"]);
  assert.ok(suggestTags("Look for the buried treasure").includes("Buried Treasure"));
});

test("inbox pairs each coach reply with the student messages before it", () => {
  const rows = [
    { id: "1", student_id: "u1", student_email: thandi.email, from_role: "student", kind: "question", body: "Is my SWOT ok, Thandi here?", created_at: "2026-10-01T10:00:00Z" },
    { id: "2", student_id: "u1", student_email: thandi.email, from_role: "student", kind: "question", body: "Also the lens?", created_at: "2026-10-01T10:05:00Z" },
    { id: "3", student_id: "u1", student_email: thandi.email, from_role: "coach", kind: "reply", body: "Thandi, link each point to going concern.", context: "Task 2", created_at: "2026-10-02T09:00:00Z" },
    { id: "4", student_id: "u1", student_email: thandi.email, from_role: "coach", kind: "feedback", body: "Well done on the resubmission.", created_at: "2026-10-03T09:00:00Z" },
  ];
  const ex = inboxExamples(rows, people);
  assert.equal(ex.length, 2);
  assert.equal(ex[0].input, "Is my SWOT ok, [student] here?\n\nAlso the lens?");
  assert.equal(ex[0].response, "[student], link each point to going concern.");
  assert.equal(ex[0].task, "Task 2");
  assert.equal(ex[1].input, "");
});

test("assignments: one example per written comment, status-only lines skipped", () => {
  const feedback = "--- 2026-10-01T10:00:00Z ---\nGood start, but more points.\n\n--- 2026-10-02T10:00:00Z ---\nStatus changed to Approved.\n\n--- 2026-10-03T10:00:00Z ---\nMuch better.";
  const ex = submissionExamples([{ id: "s1", student_id: "u1", lesson_id: "l1", body: "My answer", link_url: "https://drive", status: "approved", grade: 7, feedback, feedback_file_url: "x" }], people, new Map([["l1", "Task 1 SWOT"]]));
  assert.equal(ex.length, 2);
  assert.equal(ex[0].task, "Task 1 SWOT");
  assert.equal(ex[0].input, "My answer\n\n[link to submitted work]");
  assert.equal(ex[0].grade, "7");
  assert.ok(ex[0].feedback_file);
  assert.deepEqual(ex[0].tags, ["Volume"]);
});

test("surveys label answers by question and mark uploads", () => {
  const ex = surveyExamples(
    [{ id: "r1", survey_id: "v1", student_id: "u1", answers: { q1: "Theory", q2: "{\"url\":\"x\"}", q3: "" }, feedback: "Plain feedback, no stamp" }],
    new Map([["v1", { title: "BMCR form", questions: [{ id: "q1", type: "radio", label: "Main problem" }, { id: "q2", type: "pdf_upload", label: "Your script" }, { id: "q3", type: "long_text", label: "Notes" }] }]]),
    people
  );
  assert.equal(ex.length, 1);
  assert.equal(ex[0].input, "Main problem: Theory\nYour script: [PDF uploaded]");
  assert.equal(ex[0].response, "Plain feedback, no stamp");
});

test("finalise drops repeats and sorts newest first; exports render", () => {
  const base = { source: "inbox" as const, student: "S-1", task: "t", input: "i", status: null, grade: null, feedback_file: false, tags: [] };
  const list = finaliseCorpus([
    { ...base, id: "a", at: "2026-10-01", response: "same" },
    { ...base, id: "b", at: "2026-10-02", response: "same" },
    { ...base, id: "c", at: "2026-10-03", response: "other" },
  ]);
  assert.deepEqual(list.map((e) => e.id), ["c", "b"]);
  assert.equal(toJsonl(list).trim().split("\n").length, 2);
  assert.ok(toMarkdown(list, "2026-10-29T00:00:00Z").includes("**Yvonne:**"));
});
