import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EXERCISES,
  READING_CHECK,
  buildAttempt,
  buildMarkingPrompt,
  caseWords,
  getExercise,
  gradeBand,
  markingCostUsd,
  normaliseMarking,
  paceBand,
  readingProfile,
  recommend,
  recommendUnused,
  remainingExercises,
  rtfqRead,
  sentencesOf,
  type DrillAttempt,
  type Marking,
} from "./reading-drills";

test("every exercise is complete and internally consistent", () => {
  assert.equal(EXERCISES.length, 5);
  for (const ex of EXERCISES) {
    const ids = new Set(sentencesOf(ex.case).map((s) => s.id));
    assert.equal(ids.size, sentencesOf(ex.case).length, `${ex.id}: sentence ids are unique`);
    for (const r of ex.rows) for (const c of r.clues) assert.ok(ids.has(c), `${ex.id} ${r.id}: clue ${c} exists`);
    assert.ok(ex.rows.length >= ex.marks, `${ex.id}: at least one row per mark`);
    assert.ok(ex.rtfq.directions.options.some((o) => o.required));
    for (const q of ex.recall) assert.ok(q.correct >= 0 && q.correct < q.options.length);
  }
  assert.ok(caseWords(READING_CHECK) > 1000, "the reading check is a long case");
});

test("pace bands follow the exam benchmark", () => {
  assert.equal(paceBand(90).label, "Slow");
  assert.equal(paceBand(120).label, "Exam pace");
  assert.equal(paceBand(180).label, "Quick");
  assert.equal(paceBand(400).label, "Very fast");
  assert.equal(paceBand(5000).label, "Not a real read");
  assert.equal(readingProfile(200, 0.4).title, "Skimming");
  assert.equal(readingProfile(120, 0.9).title, "On track");
  assert.equal(readingProfile(80, 0.9).title, "Thorough but slow");
});

test("result range is a band against the 50% pass, not a mark", () => {
  assert.equal(gradeBand(25).label, "Below 40%");
  assert.equal(gradeBand(45).verdict, "Just short of a pass");
  assert.deepEqual([gradeBand(57).label, gradeBand(57).verdict], ["50%–60%", "A pass, just"]);
  assert.equal(gradeBand(100).label, "80% and above");
});

test("an attempt counts noted clues, earned rows, signals and the potential range", () => {
  const ex = getExercise("mopane")!;
  const raw = {
    rtfq: { shape: { delivered: "yes", note: "" }, directions: { delivered: "partly", note: "used para 3" }, lens: { delivered: "yes", note: "" } },
    rows: [{ id: "r1", earned: true }, { id: "r6", earned: true }],
    used_traps: ["m10", "m3"],
    fix: "Leave paragraph 3 out.",
  };
  const marking: Marking = normaliseMarking(ex, raw);
  assert.deepEqual(marking.traps, ["m10"], "only real trap sentences are kept");
  assert.equal(Object.keys(marking.rows).length, ex.rows.length, "missing rows are filled in as not earned");
  const notes = [
    { id: 1, sentence: "m3", word: 3, wordText: "only", text: "S licence", phase: "read" as const, crossed: false },
    { id: 2, sentence: "m13", word: 3, wordText: "have", text: "O charters", phase: "post" as const, crossed: false },
    { id: 3, sentence: "m12", word: 0, wordText: "A", text: "x", phase: "read" as const, crossed: true },
  ];
  const a = buildAttempt({
    ex, readSec: 120, answerSec: 200, totalSec: 600, recallPicks: [0, 0, 1, 0],
    read: rtfqRead(ex, { shape: ex.rtfq.shape.correct, lens: ex.rtfq.lens.correct, dir: [0, 1, 2] }),
    notes, answer: "word ".repeat(40), marking, markedBy: "model",
  });
  assert.equal(a.recall, 3);
  assert.equal(a.buried_treasure.dSpot, 1, "crossed-out notes do not count as noticing");
  assert.equal(a.buried_treasure.iSpot, 1);
  assert.equal(a.grade.pct, 25);
  assert.equal(a.grade.potPct, 38, "the noted but unused charter clue adds to the potential");
  assert.ok(a.signals.includes("RTFQ"));
  assert.ok(a.signals.includes("Buried Treasure: Direct"));
  assert.equal(a.rtfq_read.dir, 1);
});

test("the next exercise targets the weakest trained skill", () => {
  assert.ok(recommend([]).reason.startsWith("A good first exercise"));
  const ex = getExercise("baobab")!;
  const marking = normaliseMarking(ex, { rtfq: { shape: { delivered: "no" }, directions: { delivered: "no" }, lens: { delivered: "no" } }, rows: [] });
  const a = buildAttempt({ ex, readSec: 100, answerSec: 100, totalSec: 300, recallPicks: [0, 0, 0, 0], read: { shape: 0, dir: 0, lens: 0 }, notes: [], answer: "x", marking, markedBy: "self" });
  const next = recommend([a]);
  assert.notEqual(next.exercise.id, "baobab", "a just-done exercise is not repeated straight away");
});

test("the marking prompt carries the rules, the rows and the answer, and costs cents", () => {
  const ex = getExercise("ubuntu")!;
  const prompt = buildMarkingPrompt(ex, "My answer about intimidation.");
  assert.ok(prompt.includes("say \"communication\""));
  for (const r of ex.rows) assert.ok(prompt.includes(`${r.id} [${r.proximity}]`));
  assert.ok(prompt.includes("My answer about intimidation."));
  assert.ok(prompt.length < 9000, "about 2,000 tokens");
  assert.equal(markingCostUsd("claude-sonnet-5-5", 2000, 700), 0.011);
  assert.equal(markingCostUsd("claude-haiku-5-5", 2000, 700), 0.00055);
});

test("a lesson's tool setting resolves to the right tool, and unknown values show nothing", async () => {
  const { parseLessonTool, lessonToolOptions } = await import("./reading-drills");
  assert.deepEqual(parseLessonTool("reading-check"), { kind: "check" });
  assert.deepEqual(parseLessonTool("reading-drill:next"), { kind: "next" });
  assert.equal((parseLessonTool("reading-drill:ubuntu") as { exercise: { id: string } }).exercise.id, "ubuntu");
  assert.equal(parseLessonTool("reading-drill:nope"), null);
  assert.equal(parseLessonTool(""), null);
  assert.equal(parseLessonTool(null), null);
  for (const option of lessonToolOptions()) assert.ok(parseLessonTool(option.value), `${option.value} resolves`);
});

test("each reading exercise can only be recommended once all unused ones are gone", () => {
  const used = EXERCISES.map((exercise) => ({ exercise_id: exercise.id }) as DrillAttempt);
  assert.equal(remainingExercises([]).length, EXERCISES.length);
  assert.equal(remainingExercises(used.slice(0, 1)).length, EXERCISES.length - 1);
  assert.equal(recommendUnused(used), null);
  assert.ok(recommendUnused([]));
});

test("reading tasks stay one-attempt and coaches can reset them", () => {
  const sql = readFileSync(resolve("supabase/reading-attempt-once.sql"), "utf8");
  const mark = readFileSync(resolve("app/api/reading/mark/route.ts"), "utf8");
  const coach = readFileSync(resolve("app/api/coach/reading/route.ts"), "utf8");
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  assert.match(sql, /reading_attempts_user_exercise_uidx/);
  assert.match(sql, /staff delete reading attempts/);
  assert.match(mark, /READING_ONCE_COPY/);
  assert.match(coach, /reading_mark_calls/);
  assert.match(profile, /ReadingAttemptsPanel/);
});

test("the Direct / Indirect table groups every row with its case wording, and lists the traps", async () => {
  const { proximityTable, PROXIMITY_WHY } = await import("./reading-drills");
  for (const ex of EXERCISES) {
    const t = proximityTable(ex);
    assert.equal(t.direct.length + t.indirect.length + t.thinking.length, ex.rows.length, ex.id);
    for (const item of [...t.direct, ...t.indirect]) assert.ok(item.caseText.length > 0, `${ex.id} ${item.row.id} shows case wording`);
    assert.ok(t.traps.every((x) => x.why), ex.id);
  }
  const hv = proximityTable(getExercise("highveld")!);
  assert.ok(hv.direct.some((x) => x.row.id === "r4" && x.caseText.some((q) => q.includes("nine consecutive years"))));
  assert.equal(hv.indirect[0].why, PROXIMITY_WHY.indirect);
  assert.equal(hv.traps.length, 3);
});
