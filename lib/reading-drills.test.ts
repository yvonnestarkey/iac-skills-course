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
  isInteractiveLesson,
  markingCostUsd,
  MARKING_SCHEMA,
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
  assert.equal(EXERCISES.length, 7);
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
  assert.deepEqual(parseLessonTool("variance-bakery"), { kind: "variance-bakery" });
  assert.equal(parseLessonTool("reading-drill:nope"), null);
  assert.equal(parseLessonTool(""), null);
  assert.equal(parseLessonTool(null), null);
  for (const option of lessonToolOptions()) assert.ok(parseLessonTool(option.value), `${option.value} resolves`);
});

test("interactive tools use a pointer icon in the course sidebar", () => {
  assert.equal(isInteractiveLesson({ tool: "variance-bakery" }), true);
  assert.equal(isInteractiveLesson({ tool: "reading-check" }), true);
  assert.equal(isInteractiveLesson({ tool: "reading-drill:mopane" }), true);
  assert.equal(isInteractiveLesson({ id: "ch10-l12", title: "Variance Bakery" }), true);
  assert.equal(isInteractiveLesson({ title: "A lecture" }), false);
  const icon = readFileSync(resolve("components/lesson/LessonTypeIcon.tsx"), "utf8");
  const nav = readFileSync(resolve("components/course/CoursePhaseAccordions.tsx"), "utf8");
  assert.match(icon, /MousePointerClick/);
  assert.match(icon, /isInteractiveLesson/);
  assert.match(nav, /tool=\{lesson\.tool\}/);
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
  const drill = readFileSync(resolve("components/reading/DrillFlow.tsx"), "utf8");
  const check = readFileSync(resolve("components/reading/ReadingCheckFlow.tsx"), "utf8");
  const reset = readFileSync(resolve("components/reading/CoachReadingReset.tsx"), "utf8");
  assert.match(sql, /reading_attempts_user_exercise_uidx/);
  assert.match(sql, /staff delete reading attempts/);
  assert.match(mark, /READING_ONCE_COPY/);
  assert.match(coach, /reading_mark_calls/);
  assert.match(profile, /ReadingAttemptsPanel/);
  assert.match(drill, /CoachReadingReset/);
  assert.match(check, /CoachReadingReset/);
  assert.match(reset, /isCoachAccount/);
  assert.match(reset, /Reset/);
});

test("the Direct / Indirect table groups every row with its case wording, and lists the traps", async () => {
  const { proximityTable, PROXIMITY_WHY } = await import("./reading-drills");
  for (const ex of EXERCISES) {
    const t = proximityTable(ex);
    assert.equal(t.direct.length + t.indirect.length + t.thinking.length, ex.rows.filter((r) => !r.skill).length, ex.id);
    for (const item of [...t.direct, ...t.indirect]) assert.ok(item.caseText.length > 0, `${ex.id} ${item.row.id} shows case wording`);
    assert.ok(t.traps.every((x) => x.why), ex.id);
  }
  const hv = proximityTable(getExercise("highveld")!);
  assert.ok(hv.direct.some((x) => x.row.id === "r4" && x.caseText.some((q) => q.includes("nine consecutive years"))));
  assert.equal(hv.indirect[0].why, PROXIMITY_WHY.indirect);
  assert.equal(hv.traps.length, 3);
});

test("Karoo applies the mark plan's caps and opens as a live link", async () => {
  const { rowMarks, getLiveExercise } = await import("./reading-drills");
  const ex = getExercise("karoo")!;
  assert.equal(rowMarks(ex, ["r10", "r11", "r12", "r13"]), 3, "going concern indicators max 3");
  assert.equal(rowMarks(ex, ["r14", "r15", "r16", "r1"]), 3, "IFRS judgements max 2");
  assert.equal(rowMarks(ex, ex.rows.map((r) => r.id)), 12, "part (a) max 11, plus communication");
  assert.equal(rowMarks(getExercise("mopane")!, ["r1", "r2"]), 2, "no caps: one row, one mark");
  assert.ok(getLiveExercise("karoo"));
  assert.equal(getLiveExercise("mopane"), null, "only listed exercises open as a live link");
  assert.ok(buildMarkingPrompt(ex, "x").includes("x1 [communication]"));
  const page = readFileSync(resolve("app/live/[exerciseId]/page.tsx"), "utf8");
  const middleware = readFileSync(resolve("middleware.ts"), "utf8");
  assert.match(page, /getLiveExercise/);
  assert.doesNotMatch(middleware, /"\/live/, "the live link needs no sign-in");
});

test("the live link asks for an email and saves attempts under it", async () => {
  const { cleanLiveEmail } = await import("./reading-drills");
  assert.equal(cleanLiveEmail("  Thandi@Example.co.za "), "thandi@example.co.za");
  assert.equal(cleanLiveEmail("thandi"), "");
  assert.equal(cleanLiveEmail("a@b"), "");
  const drill = readFileSync(resolve("components/reading/DrillFlow.tsx"), "utf8");
  const save = readFileSync(resolve("app/api/reading/live-attempt/route.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/reading-live.sql"), "utf8");
  assert.match(drill, /rd-live-email/);
  assert.match(drill, /\/api\/reading\/live-attempt/);
  assert.match(save, /reading_live_attempts/);
  assert.match(sql, /create table if not exists public.reading_live_attempts/);
  assert.match(readFileSync(resolve("lib/course-tools.ts"), "utf8"), /\/coach\/tools\/live-sessions/);
});

test("the marking splits the answer into points, each with a verdict and what it is missing", () => {
  const ex = getExercise("karoo")!;
  const m = normaliseMarking(ex, {
    rows: [{ id: "r6", earned: true }],
    points: [
      { text: "The CFO processes journals himself, so management could override controls.", row: "r6", earned: true, missing: "ignored" },
      { text: "The company is struggling.", row: null, earned: true, missing: "" },
      { text: "Loan breach.", row: "r99", earned: false, missing: "Say what it does to the statements." },
      { text: "   ", row: null, earned: false, missing: "" },
    ],
  });
  assert.equal(m.points!.length, 3, "blank points are dropped");
  assert.deepEqual([m.points![0].earned, m.points![0].missing], [true, ""]);
  assert.equal(m.points![1].earned, false, "no row, no mark");
  assert.equal(m.points![2].row, null, "unknown row ids are dropped");
  assert.ok(buildMarkingPrompt(ex, "x").includes("POINTS:"));
  assert.ok(MARKING_SCHEMA.required.includes("points"));
  assert.match(readFileSync(resolve("components/reading/DrillFlow.tsx"), "utf8"), /Your answer, marked point by point/);
});
