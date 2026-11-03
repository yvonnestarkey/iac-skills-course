import {
  getExercise,
  markingFromAttempt,
  notedNotUsed,
  sentencesOf,
  type DrillAttempt,
  type DrillExercise,
  type DrillNote,
  type ReadingCheckCase,
  type ReadingCheckResult,
  type SentenceKind,
} from "@/lib/reading-drills";

export type SavedNote = Omit<DrillNote, "id">;

export type NoteAccuracy = "direct" | "indirect" | "trap" | "background" | "unknown";

export type CoachNoteReview = SavedNote & {
  sentenceText: string;
  accuracy: NoteAccuracy;
  accuracyLabel: string;
};

export type CoachRowReview = {
  id: string;
  point: string;
  proximity: "direct" | "indirect" | "thinking";
  noted: boolean;
  earned: boolean;
  clueTexts: string[];
};

export type CoachAttemptReview = {
  notes: CoachNoteReview[];
  liveNotes: CoachNoteReview[];
  crossedNotes: CoachNoteReview[];
  rows: CoachRowReview[];
  missedRows: CoachRowReview[];
  notedNotUsed: CoachRowReview[];
  missedClues: { id: string; text: string; kind: "direct" | "indirect" }[];
  answer: string;
};

const TRAPS = new Set<SentenceKind>(["excluded", "off_required", "wrong_level"]);

export function sentenceKindAccuracy(kind: SentenceKind | undefined): NoteAccuracy {
  if (kind === "direct") return "direct";
  if (kind === "indirect") return "indirect";
  if (kind && TRAPS.has(kind)) return "trap";
  if (kind == null) return "background";
  return "unknown";
}

export function accuracyLabel(accuracy: NoteAccuracy): string {
  if (accuracy === "direct") return "Direct clue";
  if (accuracy === "indirect") return "Indirect clue";
  if (accuracy === "trap") return "Trap — not needed for the required";
  if (accuracy === "background") return "Background — not a mark clue";
  return "Case note";
}

export function phaseLabel(phase: SavedNote["phase"]): string {
  return phase === "read" ? "While reading" : "After the required";
}

export function attemptNotes(attempt: DrillAttempt | null | undefined): SavedNote[] {
  return Array.isArray(attempt?.notes) ? attempt.notes : [];
}

export function checkNotes(check: ReadingCheckResult | null | undefined): SavedNote[] {
  return Array.isArray(check?.notes_detail) ? check.notes_detail : [];
}

export function reviewAttempt(ex: DrillExercise | null, attempt: DrillAttempt): CoachAttemptReview {
  const sents = ex ? sentencesOf(ex.case) : [];
  const byId = new Map(sents.map((sentence) => [sentence.id, sentence]));
  const notes = attemptNotes(attempt).map((note) => {
    const sentence = byId.get(note.sentence);
    const accuracy = sentenceKindAccuracy(sentence?.kind);
    return {
      ...note,
      sentenceText: sentence?.text || "",
      accuracy,
      accuracyLabel: accuracyLabel(accuracy),
    };
  });
  const live = new Set(notes.filter((note) => !note.crossed).map((note) => note.sentence));
  const marking = ex ? markingFromAttempt(ex, attempt) : null;
  const rows: CoachRowReview[] = (ex?.rows || []).map((row) => ({
    id: row.id,
    point: row.point,
    proximity: row.proximity,
    noted: row.clues.some((clue) => live.has(clue)),
    earned: Boolean(marking?.rows[row.id]?.earned),
    clueTexts: row.clues.map((clue) => byId.get(clue)?.text || clue).filter(Boolean),
  }));
  const unused = ex && marking ? notedNotUsed(ex, marking, live) : [];
  const unusedIds = new Set(unused.map((row) => row.id));
  return {
    notes,
    liveNotes: notes.filter((note) => !note.crossed),
    crossedNotes: notes.filter((note) => note.crossed),
    rows,
    missedRows: rows.filter((row) => !row.earned && row.proximity !== "thinking"),
    notedNotUsed: rows.filter((row) => unusedIds.has(row.id)),
    missedClues: sents
      .filter((sentence) => (sentence.kind === "direct" || sentence.kind === "indirect") && !live.has(sentence.id))
      .map((sentence) => ({
        id: sentence.id,
        text: sentence.text,
        kind: sentence.kind as "direct" | "indirect",
      })),
    answer: String(attempt.answer || "").trim(),
  };
}

export function reviewCheck(check: ReadingCheckResult, caseData: ReadingCheckCase | null) {
  const notes = checkNotes(check);
  const missed = (check.missed || [])
    .map((index) => caseData?.recall[index] || null)
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  return { notes, missed };
}

export function exerciseForAttempt(attempt: DrillAttempt, extras: DrillExercise[] = []): DrillExercise | null {
  return getExercise(attempt.exercise_id) || extras.find((item) => item.id === attempt.exercise_id) || null;
}
