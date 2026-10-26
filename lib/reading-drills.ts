/**
 * Read the Required: reading and RTFQ / Buried Treasure drills.
 * Pure logic only (no React, no Supabase), so it runs in the browser, the API route and the tests.
 * Spec: Obsidian "Reading and Comprehension Tool / Read the Required - Tool Spec".
 */
import config from "@/lib/data/reading-drills/config.json";
import mopane from "@/lib/data/reading-drills/mopane.json";
import ubuntu from "@/lib/data/reading-drills/ubuntu.json";
import baobab from "@/lib/data/reading-drills/baobab.json";
import lindiwe from "@/lib/data/reading-drills/lindiwe.json";
import highveld from "@/lib/data/reading-drills/highveld.json";
import khanyisa from "@/lib/data/reading-drills/reading-check-khanyisa.json";

/* ---------------------------------------------------------------- types */

export type SentenceKind = "direct" | "indirect" | "excluded" | "off_required" | "wrong_level" | null;
export type Sentence = { id: string; text: string; kind?: SentenceKind };
export type CaseSection = { heading: string; sentences: Sentence[] };
export type RecallQuestion = { question: string; options: string[]; correct: number };
export type Proximity = "direct" | "indirect" | "thinking";
/** `why` (optional) explains the jump from the case to the point; without it, the feedback uses the general explanation for the type. */
export type MarkRow = { id: string; proximity: Proximity; point: string; clues: string[]; marks: number; why?: string };
export type SkillKey = "read_speed" | "read_comp" | "shape" | "dir" | "lens" | "direct" | "indirect";
export type Delivered = "yes" | "partly" | "no";

export type DrillExercise = {
  id: string;
  title: string;
  area: string;
  marks: number;
  answer_minutes: number;
  trains: SkillKey[];
  case: CaseSection[];
  required: string;
  recall: RecallQuestion[];
  rtfq: {
    shape: { options: string[]; correct: number; why: string };
    directions: { options: { text: string; required: boolean }[]; why: string };
    lens: { options: string[]; correct: number; why: string };
  };
  rows: MarkRow[];
};

export type ReadingCheckCase = { id: string; title: string; case: CaseSection[]; recall: RecallQuestion[] };

export type DrillNote = {
  id: number;
  sentence: string;
  word: number;
  wordText: string;
  text: string;
  phase: "read" | "post";
  crossed: boolean;
};

export type Marking = {
  rtfq: Record<"shape" | "dir" | "lens", { delivered: Delivered; note: string }>;
  rows: Record<string, { earned: boolean; evidence: string }>;
  traps: string[];
  fix: string;
};

/** One saved practice attempt (a row of public.reading_attempts). */
export type DrillAttempt = {
  id?: string;
  exercise_id: string;
  created_at?: string;
  wpm: number;
  read_sec: number;
  answer_sec: number;
  total_sec: number;
  recall: number;
  recall_n: number;
  rtfq_read: { shape: number; dir: number; lens: number };
  rtfq_delivered: { shape: Delivered; dir: Delivered; lens: Delivered };
  buried_treasure: { dTot: number; dSpot: number; iTot: number; iSpot: number; dRows: number; dEarn: number; iRows: number; iEarn: number };
  rows_earned: string[];
  notes: Omit<DrillNote, "id">[];
  answer: string;
  fix: string;
  signals: string[];
  grade: { pct: number; potPct: number };
  marked_by: "model" | "self";
  mark_call_id?: string | null;
};

/** One saved reading check (a row of public.reading_checks). */
export type ReadingCheckResult = {
  id?: string;
  check_id: string;
  created_at?: string;
  wpm: number;
  read_sec: number;
  absorb: number;
  absorb_n: number;
  missed: number[];
  notes: number;
  profile: string;
};

/* ---------------------------------------------------------------- data */

const ALL: Record<string, DrillExercise> = Object.fromEntries(
  [mopane, ubuntu, baobab, lindiwe, highveld].map((ex) => [ex.id, ex as unknown as DrillExercise])
);
export const EXERCISES: DrillExercise[] = config.exercises.map((id) => ALL[id]).filter(Boolean);
export const READING_CHECK = khanyisa as unknown as ReadingCheckCase;
export const DAILY_MARKED_LIMIT = config.dailyMarkedLimit;
export const EXAM = config.exam;

export function getExercise(id: string): DrillExercise | null {
  return ALL[id] || null;
}

export const SKILLS: Record<SkillKey, string> = {
  read_speed: "Reading pace",
  read_comp: "Absorption",
  shape: "RTFQ: Shape",
  dir: "RTFQ: Directions",
  lens: "RTFQ: Lens",
  direct: "Buried Treasure: Direct",
  indirect: "Buried Treasure: Indirect",
};

/* ---------------------------------------------------------------- reading pace */

export const sentencesOf = (sections: CaseSection[]): Sentence[] => sections.flatMap((s) => s.sentences);
export const countWords = (text: string): number => text.trim().split(/\s+/).filter(Boolean).length;
export function caseWords(c: { case: CaseSection[]; required?: string }): number {
  return countWords(sentencesOf(c.case).map((s) => s.text).join(" ") + " " + (c.required || ""));
}
export const wordsPerMinute = (words: number, seconds: number): number => Math.round(words / Math.max(seconds, 1) * 60);

export type PaceBand = { label: string; score: number };
export function paceBand(wpm: number): PaceBand {
  const band = config.bands.find((b) => b.max === null || wpm < b.max) || config.bands[config.bands.length - 1];
  return { label: band.label, score: band.score };
}
/** Seconds a case should take at exam pace (150 down to 100 words a minute). */
export const paceWindow = (words: number): [number, number] => [(words / 150) * 60, (words / 100) * 60];
/** Minutes the first read of a full exam case would take at this pace. */
export const examReadMinutes = (wpm: number): number => Math.round(EXAM.words / Math.max(wpm, 1));

export function readingProfile(wpm: number, absorbed: number): { title: string; text: string } {
  const pace = wpm < 100 ? "slow" : wpm <= 150 ? "exam" : "fast";
  const good = absorbed >= 0.75;
  const mins = examReadMinutes(wpm);
  const table: Record<string, [string, string]> = {
    "exam-true": ["On track", "Your pace and your absorption are where the exam needs them. Keep this rhythm, and keep making notes as you read."],
    "fast-true": ["Quick and absorbing", "You read faster than you need to and still take it in. Use the time in hand to index more carefully, not to rush your answers."],
    "fast-false": ["Skimming", "You move quickly, but little of it stays with you. You will end up going back to the case again and again, which costs more time than reading it properly once. Slow down to exam pace, and at the end of each section note in a word or two what it was about."],
    "exam-false": ["Right pace, not enough going in", "Your pace is fine, but the big picture is not sticking. As you read, keep four questions in mind: what is this business, who am I, what are the main transactions, and what is the main problem? Make a short note for each section."],
    "slow-true": ["Thorough but slow", `You take it in well, but at this pace the first read of an exam case would take about ${mins} minutes against a budget of ${EXAM.readMin} to ${EXAM.readMax}. That time comes out of answering. Keep the same notes, but move on sooner.`],
    "slow-false": ["Slow, and not much going in", "Both pace and absorption need work. Start with absorption: read each section asking what it is about, note it in a few words, then move on. Speed comes once the habit is in place."],
  };
  const [title, text] = table[`${pace}-${good}`];
  return { title, text };
}

/** A short line on reading inside a practice exercise. */
export function readingNote(wpm: number, recallRatio: number): string {
  if (paceBand(wpm).score < 0.3) return "That was too quick to be a real read. Read the case properly before moving on; the recall questions depend on it.";
  if (wpm > 150 && recallRatio < 0.5) return "Fast, but you kept little of it. That is skimming: slow down enough to hold the big picture.";
  if (wpm < 100 && recallRatio === 1) return "You took it all in, but slowly. Keep the same focus and move on a little sooner.";
  if (recallRatio < 0.75) return "The big picture did not stick. As you read, ask: what is this business, who am I, what are the main transactions, and what is the main problem?";
  return "Good balance of pace and absorption.";
}

/* ---------------------------------------------------------------- scoring */

export function rtfqRead(ex: DrillExercise, pick: { shape: number; lens: number; dir: number[] }) {
  const ticked = new Set(pick.dir);
  const opts = ex.rtfq.directions.options;
  return {
    shape: pick.shape === ex.rtfq.shape.correct ? 1 : 0,
    lens: pick.lens === ex.rtfq.lens.correct ? 1 : 0,
    dir: opts.filter((o, i) => o.required === ticked.has(i)).length / opts.length,
  };
}

export function signalsFor(a: Pick<DrillAttempt, "rtfq_delivered" | "buried_treasure">): string[] {
  const out: string[] = [];
  const d = a.rtfq_delivered;
  if (d.shape !== "yes" || d.dir !== "yes" || d.lens === "no") out.push("RTFQ");
  const bt = a.buried_treasure;
  if (bt.dRows && bt.dEarn / bt.dRows < 0.5) out.push("Buried Treasure: Direct");
  if (bt.iRows && bt.iEarn / bt.iRows < 0.5) out.push("Buried Treasure: Indirect");
  return out;
}

/** Rows whose clue the student noted (live notes only) but did not earn. */
export function notedNotUsed(ex: DrillExercise, marking: Marking, noted: Set<string>): MarkRow[] {
  return ex.rows.filter((r) => r.proximity !== "thinking" && !marking.rows[r.id]?.earned && r.clues.some((c) => noted.has(c)));
}

/** Build the saved attempt from the run and the marking. */
export function buildAttempt(input: {
  ex: DrillExercise;
  readSec: number;
  answerSec: number;
  totalSec: number;
  recallPicks: number[];
  read: DrillAttempt["rtfq_read"];
  notes: DrillNote[];
  answer: string;
  marking: Marking;
  markedBy: "model" | "self";
  markCallId?: string | null;
}): DrillAttempt {
  const { ex, marking } = input;
  const sents = sentencesOf(ex.case);
  const noted = new Set(input.notes.filter((n) => !n.crossed).map((n) => n.sentence));
  const D = sents.filter((s) => s.kind === "direct").map((s) => s.id);
  const I = sents.filter((s) => s.kind === "indirect").map((s) => s.id);
  const rowsD = ex.rows.filter((r) => r.proximity === "direct");
  const rowsI = ex.rows.filter((r) => r.proximity === "indirect");
  const earned = (r: MarkRow) => Boolean(marking.rows[r.id]?.earned);
  const rowsEarned = ex.rows.filter(earned);
  const earnedMarks = rowsEarned.reduce((sum, r) => sum + (r.marks || 1), 0);
  const potentialMarks = earnedMarks + notedNotUsed(ex, marking, noted).reduce((sum, r) => sum + (r.marks || 1), 0);
  const attempt: DrillAttempt = {
    exercise_id: ex.id,
    wpm: wordsPerMinute(caseWords(ex), input.readSec),
    read_sec: Math.round(input.readSec),
    answer_sec: Math.round(input.answerSec),
    total_sec: Math.round(input.totalSec),
    recall: input.recallPicks.filter((p, i) => p === ex.recall[i].correct).length,
    recall_n: ex.recall.length,
    rtfq_read: input.read,
    rtfq_delivered: { shape: marking.rtfq.shape.delivered, dir: marking.rtfq.dir.delivered, lens: marking.rtfq.lens.delivered },
    buried_treasure: {
      dTot: D.length, dSpot: D.filter((id) => noted.has(id)).length,
      iTot: I.length, iSpot: I.filter((id) => noted.has(id)).length,
      dRows: rowsD.length, dEarn: rowsD.filter(earned).length,
      iRows: rowsI.length, iEarn: rowsI.filter(earned).length,
    },
    rows_earned: rowsEarned.map((r) => r.id),
    notes: input.notes.map(({ id: _id, ...rest }) => rest),
    answer: input.answer.slice(0, 6000),
    fix: marking.fix,
    signals: [],
    grade: {
      pct: Math.round((100 * Math.min(earnedMarks, ex.marks)) / ex.marks),
      potPct: Math.round((100 * Math.min(potentialMarks, ex.marks)) / ex.marks),
    },
    marked_by: input.markedBy,
    mark_call_id: input.markCallId ?? null,
  };
  attempt.signals = signalsFor(attempt);
  return attempt;
}

/* ---------------------------------------------------------------- result range */

export type GradeBand = { lo: number; hi: number; label: string; pass: boolean; verdict: string };
/** A range against the 50% pass, not a mark. One marker's row = one mark, capped at the question's marks. */
export function gradeBand(pct: number): GradeBand {
  const lo = pct >= 80 ? 80 : pct < 40 ? 0 : Math.floor(pct / 10) * 10;
  const label = lo >= 80 ? "80% and above" : lo === 0 ? "Below 40%" : `${lo}%–${lo + 10}%`;
  const verdict = lo >= 50 ? (lo === 50 ? "A pass, just" : "A pass") : lo === 40 ? "Just short of a pass" : "Well short of a pass";
  return { lo, hi: lo >= 80 ? 100 : lo === 0 ? 40 : lo + 10, label, pass: lo >= 50, verdict };
}

/* ---------------------------------------------------------------- skills and the next exercise */

const avg = (xs: number[]): number | null => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const del = (d: Delivered) => (d === "yes" ? 1 : d === "partly" ? 0.5 : 0);

export function attemptSkills(a: DrillAttempt): Record<SkillKey, number> {
  const bt = a.buried_treasure;
  return {
    read_speed: paceBand(a.wpm).score,
    read_comp: a.recall / (a.recall_n || 1),
    shape: (a.rtfq_read.shape + del(a.rtfq_delivered.shape)) / 2,
    dir: (a.rtfq_read.dir + del(a.rtfq_delivered.dir)) / 2,
    lens: (a.rtfq_read.lens + del(a.rtfq_delivered.lens)) / 2,
    direct: ((bt.dTot ? bt.dSpot / bt.dTot : 1) + (bt.dRows ? bt.dEarn / bt.dRows : 1)) / 2,
    indirect: ((bt.iTot ? bt.iSpot / bt.iTot : 1) + (bt.iRows ? bt.iEarn / bt.iRows : 1)) / 2,
  };
}

/** Average of the last three attempts per skill (attempts oldest first). */
export function skillProfile(attempts: DrillAttempt[]): Record<SkillKey, number | null> {
  const recent = attempts.slice(-3).map(attemptSkills);
  const out = {} as Record<SkillKey, number | null>;
  (Object.keys(SKILLS) as SkillKey[]).forEach((k) => (out[k] = avg(recent.map((r) => r[k]))));
  return out;
}

export function recentRange(attempts: DrillAttempt[]): GradeBand | null {
  const pcts = attempts.slice(-3).map((a) => a.grade?.pct).filter((p): p is number => typeof p === "number");
  const mean = avg(pcts);
  return mean == null ? null : gradeBand(mean);
}

export const READING_ONCE_COPY =
  "You can do each reading task once. If something went wrong, message your coach so they can reset it.";

export function remainingExercises(attempts: DrillAttempt[]): DrillExercise[] {
  const done = new Set(attempts.map((attempt) => attempt.exercise_id));
  return EXERCISES.filter((exercise) => !done.has(exercise.id));
}

export function attemptForExercise(attempts: DrillAttempt[], exerciseId: string): DrillAttempt | null {
  return [...attempts].reverse().find((attempt) => attempt.exercise_id === exerciseId) || null;
}

export function checkForId(checks: ReadingCheckResult[], checkId: string): ReadingCheckResult | null {
  return [...checks].reverse().find((check) => check.check_id === checkId) || null;
}

export function markingFromAttempt(ex: DrillExercise, attempt: DrillAttempt): Marking {
  const earned = new Set(attempt.rows_earned || []);
  return {
    rtfq: {
      shape: { delivered: attempt.rtfq_delivered.shape, note: "" },
      dir: { delivered: attempt.rtfq_delivered.dir, note: "" },
      lens: { delivered: attempt.rtfq_delivered.lens, note: "" },
    },
    rows: Object.fromEntries(ex.rows.map((row) => [row.id, { earned: earned.has(row.id), evidence: "" }])),
    traps: [],
    fix: attempt.fix || "",
  };
}

export function recommend(attempts: DrillAttempt[]): { exercise: DrillExercise; reason: string } {
  const sk = skillProfile(attempts);
  const done: Record<string, number> = {};
  attempts.forEach((a) => (done[a.exercise_id] = (done[a.exercise_id] || 0) + 1));
  let best: { ex: DrillExercise; need: number } | null = null;
  for (const ex of EXERCISES) {
    const need = ex.trains.reduce((s, k) => s + (1 - (sk[k] ?? 0.5)), 0) - 0.8 * (done[ex.id] || 0);
    if (!best || need > best.need) best = { ex, need };
  }
  const ex = best!.ex;
  const weakest = ex.trains.filter((k) => sk[k] != null).sort((a, b) => (sk[a] as number) - (sk[b] as number))[0];
  const reason = weakest
    ? `It trains ${SKILLS[weakest]}, your weakest area so far (${Math.round((sk[weakest] as number) * 100)}%).`
    : `A good first exercise: it trains ${ex.trains.map((k) => SKILLS[k]).join(", ")}.`;
  return { exercise: ex, reason };
}

/** Next unread exercise, or null once every drill has been used. */
export function recommendUnused(attempts: DrillAttempt[]): { exercise: DrillExercise; reason: string } | null {
  const left = remainingExercises(attempts);
  if (!left.length) return null;
  const rec = recommend(attempts);
  if (left.some((exercise) => exercise.id === rec.exercise.id)) return rec;
  return { exercise: left[0], reason: rec.reason };
}

/* ---------------------------------------------------------------- marking */

/** Deterministic option order per run, so the correct answer is not always first. */
export function shuffledIndexes(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i);
  let s = seed;
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

const KIND_LABEL: Record<string, string> = {
  direct: "Direct clue",
  indirect: "Indirect clue",
  excluded: "EXCLUDED by the required",
  off_required: "OFF the required (trap)",
  wrong_level: "WRONG LEVEL for this required (trap)",
};

export const MARKING_SYSTEM = `You mark short practice answers for South African accounting-exam students (SAICA ITC / APC style). You mark two skills only, using the rules given. Be strict and consistent.`;

export function buildMarkingPrompt(ex: DrillExercise, answer: string): string {
  return `RTFQ: did the answer deliver what the required asked for? Judge three dimensions, each "yes", "partly" or "no", with a one-line note of the evidence on the page.
- Shape: the kind of answer the instruction word calls for. "Assess" or "evaluate" needs both sides and a conclusion; one side only, or no conclusion, is "partly".
- Directions: the conditions attached to the required (exclusions, named items, level, decision rules, required inclusions such as safeguards). Using excluded material, answering at the wrong level, or ignoring a decision rule makes this "partly" or "no".
- Lens: the angle or point of view. Answering from the wrong person's point of view, or about a different issue, is "no".
- Judge against the specific things the required names, not the general area. Being in the right general area earns nothing.
- Judge delivery only, never why.

BURIED TREASURE: for each marking row below, decide whether the answer earned it. A row is earned when the answer makes that point, in substance, tied to the case (part of the point counts as earned). Generic statements that could apply to any company do not earn a row. Do not be generous with vague waffle.

LANGUAGE for notes and "fix": plain, direct, second person ("you"). Never use the word "writing" for the skill; say "communication". Name skills only as RTFQ, Buried Treasure, Shape, Directions, Lens, Direct, Indirect. Keep each note under 30 words.

THE CASE (sentence id: text [classification]):
${sentencesOf(ex.case).map((s) => `${s.id}: ${s.text}${s.kind ? ` [${KIND_LABEL[s.kind]}]` : ""}`).join("\n")}

THE REQUIRED (${ex.marks} marks): ${ex.required}

WHAT THE REQUIRED ASKS FOR:
- Shape: ${ex.rtfq.shape.options[ex.rtfq.shape.correct]}
- Directions: ${ex.rtfq.directions.options.filter((o) => o.required).map((o) => o.text).join("; ")}
- Lens: ${ex.rtfq.lens.options[ex.rtfq.lens.correct]}

MARKING ROWS (id [Direct/Indirect/Thinking]: the point):
${ex.rows.map((r) => `${r.id} [${r.proximity}]: ${r.point}`).join("\n")}

THE STUDENT'S ANSWER:
"""
${answer.slice(0, 6000)}
"""

Record your marking with the tool. Include every row id. used_traps lists the ids of EXCLUDED, OFF or WRONG LEVEL sentences whose content the answer uses.`;
}

export const MARKING_SCHEMA = {
  type: "object" as const,
  properties: {
    rtfq: {
      type: "object",
      properties: Object.fromEntries(
        ["shape", "directions", "lens"].map((k) => [
          k,
          { type: "object", properties: { delivered: { type: "string", enum: ["yes", "partly", "no"] }, note: { type: "string" } }, required: ["delivered", "note"] },
        ])
      ),
      required: ["shape", "directions", "lens"],
    },
    rows: {
      type: "array",
      items: { type: "object", properties: { id: { type: "string" }, earned: { type: "boolean" }, evidence: { type: "string" } }, required: ["id", "earned"] },
    },
    used_traps: { type: "array", items: { type: "string" } },
    fix: { type: "string", description: "The single most useful thing to do differently next time, one sentence." },
  },
  required: ["rtfq", "rows", "used_traps", "fix"],
};

type RawMarking = {
  rtfq?: Record<string, { delivered?: string; note?: string }>;
  rows?: { id?: string; earned?: boolean; evidence?: string }[];
  used_traps?: string[];
  fix?: string;
};

/** Turn the model's answer into a complete, safe Marking (missing rows count as not earned). */
export function normaliseMarking(ex: DrillExercise, raw: RawMarking): Marking {
  const d = (x?: { delivered?: string }): Delivered => (x?.delivered === "yes" || x?.delivered === "no" ? x.delivered : "partly");
  const rows: Marking["rows"] = {};
  for (const r of raw.rows || []) if (r?.id) rows[String(r.id)] = { earned: Boolean(r.earned), evidence: String(r.evidence || "") };
  for (const r of ex.rows) if (!rows[r.id]) rows[r.id] = { earned: false, evidence: "" };
  const trapIds = new Set(sentencesOf(ex.case).filter((s) => s.kind === "excluded" || s.kind === "off_required" || s.kind === "wrong_level").map((s) => s.id));
  const rt = raw.rtfq || {};
  return {
    rtfq: {
      shape: { delivered: d(rt.shape), note: String(rt.shape?.note || "") },
      dir: { delivered: d(rt.directions), note: String(rt.directions?.note || "") },
      lens: { delivered: d(rt.lens), note: String(rt.lens?.note || "") },
    },
    rows,
    traps: (raw.used_traps || []).map(String).filter((id) => trapIds.has(id)),
    fix: String(raw.fix || ""),
  };
}

/** USD per million tokens (platform.claude.com pricing, Oct 2026). Unknown models are logged at Sonnet prices. */
const PRICES: Record<string, [number, number]> = {
  "claude-haiku-5-5": [0.1, 0.5],
  "claude-sonnet-5-5": [2, 10],
  "claude-opus-5-5": [4, 20],
};
export function markingCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const [i, o] = PRICES[model] || PRICES["claude-sonnet-5-5"];
  return Math.round(((inputTokens * i + outputTokens * o) / 1e6) * 1e5) / 1e5;
}
export const READING_MARK_MODEL_DEFAULT = "claude-sonnet-5-5";

/* ---------------------------------------------------------------- tools inside lessons */

/** What a lesson's `tool` setting can be. The course builder offers these in a dropdown. */
export type LessonTool = { kind: "check" } | { kind: "drill"; exercise: DrillExercise } | { kind: "next" };

export function lessonToolOptions(): { value: string; label: string }[] {
  return [
    { value: "reading-check", label: "Reading check (pace and absorption)" },
    { value: "reading-drill:next", label: "Reading drill: the student's next recommended exercise" },
    ...EXERCISES.map((ex) => ({ value: `reading-drill:${ex.id}`, label: `Reading drill: ${ex.title} (${ex.area})` })),
  ];
}

export function parseLessonTool(value: string | null | undefined): LessonTool | null {
  const v = String(value || "").trim();
  if (v === "reading-check") return { kind: "check" };
  if (v === "reading-drill:next") return { kind: "next" };
  if (v.startsWith("reading-drill:")) {
    const exercise = getExercise(v.slice("reading-drill:".length));
    return exercise ? { kind: "drill", exercise } : null;
  }
  return null;
}

/* ---------------------------------------------------------------- teaching the Direct / Indirect difference */

export const PROXIMITY_WHY: Record<Proximity, string> = {
  direct: "The case hands you this. Spot it, and say why it matters to the required.",
  indirect: "The case gives you the fact, but not the point. One step (apply the rule, or draw the conclusion) turns it into a mark.",
  thinking: "Nothing in the case points here. It comes from your own knowledge and judgement.",
};

export const TRAP_WHY: Record<"excluded" | "off_required" | "wrong_level", string> = {
  excluded: "The required rules this out. Anything you write on it earns nothing.",
  off_required: "It's in the case to tempt you, but it isn't what the required asks about.",
  wrong_level: "A real issue, but at the wrong level for this required.",
};

/** The rows grouped Direct, Indirect, Thinking, each with its case wording, plus the trap sentences. */
export function proximityTable(ex: DrillExercise) {
  const text = Object.fromEntries(sentencesOf(ex.case).map((s) => [s.id, s.text]));
  const group = (p: Proximity) =>
    ex.rows
      .filter((r) => r.proximity === p)
      .map((r) => ({ row: r, caseText: r.clues.map((c) => text[c]).filter(Boolean), why: r.why || PROXIMITY_WHY[p] }));
  const traps = sentencesOf(ex.case)
    .filter((s) => s.kind === "excluded" || s.kind === "off_required" || s.kind === "wrong_level")
    .map((s) => ({ sentence: s, why: TRAP_WHY[s.kind as keyof typeof TRAP_WHY] }));
  return { direct: group("direct"), indirect: group("indirect"), thinking: group("thinking"), traps };
}
