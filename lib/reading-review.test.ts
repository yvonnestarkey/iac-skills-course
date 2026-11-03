import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildAttempt, getExercise, normaliseMarking, rtfqRead, type Marking } from "./reading-drills";
import {
  accuracyLabel,
  checkNotes,
  reviewAttempt,
  reviewCheck,
  sentenceKindAccuracy,
} from "./reading-review";

test("student notes are classified against the required clues", () => {
  const ex = getExercise("mopane")!;
  const marking: Marking = normaliseMarking(ex, {
    rtfq: { shape: { delivered: "yes" }, directions: { delivered: "partly" }, lens: { delivered: "yes" } },
    rows: [{ id: "r1", earned: true }, { id: "r6", earned: true }],
    used_traps: ["m10"],
    fix: "Leave paragraph 3 out.",
  });
  const attempt = buildAttempt({
    ex,
    readSec: 120,
    answerSec: 200,
    totalSec: 600,
    recallPicks: [0, 0, 1, 0],
    read: rtfqRead(ex, { shape: ex.rtfq.shape.correct, lens: ex.rtfq.lens.correct, dir: [0, 1, 2] }),
    notes: [
      { id: 1, sentence: "m3", word: 3, wordText: "only", text: "S licence", phase: "read", crossed: false },
      { id: 2, sentence: "m13", word: 3, wordText: "have", text: "O charters", phase: "post", crossed: false },
      { id: 3, sentence: "m12", word: 0, wordText: "A", text: "x", phase: "read", crossed: true },
    ],
    answer: "Keep the Hoedspruit licence and look at the charter work.",
    marking,
    markedBy: "model",
  });
  const review = reviewAttempt(ex, attempt);
  assert.equal(review.liveNotes.length, 2);
  assert.equal(review.liveNotes[0].text, "S licence");
  assert.equal(review.liveNotes[0].accuracy, "direct");
  assert.equal(review.liveNotes[0].accuracyLabel, "Direct clue");
  assert.equal(review.liveNotes[1].accuracy, "indirect");
  assert.ok(review.missedClues.some((clue) => clue.kind === "direct"));
  assert.ok(review.missedRows.some((row) => !row.earned));
  assert.ok(review.notedNotUsed.length >= 1, "noted charter clue that was not earned");
  assert.match(review.answer, /Hoedspruit licence/);
});

test("reading check review keeps the note wording and missed questions", () => {
  assert.equal(sentenceKindAccuracy("off_required"), "trap");
  assert.equal(accuracyLabel("trap"), "Trap — not needed for the required");
  const review = reviewCheck(
    {
      check_id: "khanyisa",
      wpm: 140,
      read_sec: 400,
      absorb: 2,
      absorb_n: 4,
      missed: [0],
      notes: 1,
      notes_detail: [{ sentence: "k1", word: 0, wordText: "Khanyisa", text: "family business", phase: "read", crossed: false }],
      profile: "On track",
    },
    null
  );
  assert.equal(checkNotes({ check_id: "khanyisa", wpm: 1, read_sec: 1, absorb: 0, absorb_n: 1, missed: [], notes: 3, profile: "" }).length, 0);
  assert.equal(review.notes[0].text, "family business");
});

test("the coach reading panel opens the notes and required comparison", () => {
  const panel = readFileSync(resolve("components/coach/ReadingAttemptsPanel.tsx"), "utf8");
  const review = readFileSync(resolve("components/coach/CoachReadingReview.tsx"), "utf8");
  const save = readFileSync(resolve("lib/reading-drills-store.ts"), "utf8");
  const check = readFileSync(resolve("components/reading/ReadingCheckFlow.tsx"), "utf8");
  assert.match(panel, /Notes & review/);
  assert.match(review, /Against the required/);
  assert.match(review, /Notes they made/);
  assert.match(save, /notes_detail/);
  assert.match(check, /notes_detail/);
});
