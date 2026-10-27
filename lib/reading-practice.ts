import {
  EXERCISES,
  getExercise,
  type CaseSection,
  type DrillExercise,
  type MarkRow,
  type Proximity,
  type RecallQuestion,
  type SkillKey,
} from "@/lib/reading-drills";
import { getSupabase } from "@/lib/supabase";
import { getServiceSupabase } from "@/lib/supabase-admin";

const SKILL_KEYS = new Set<SkillKey>(["read_speed", "read_comp", "shape", "dir", "lens", "direct", "indirect"]);

export type PracticeExerciseRow = {
  id: string;
  title: string;
  area: string;
  published: boolean;
  position: number;
  payload: DrillExercise;
};

export type PracticeExerciseDraft = {
  id: string;
  title: string;
  area: string;
  marks: string;
  answer_minutes: string;
  trains: string;
  required: string;
  caseText: string;
  recallText: string;
  shapeText: string;
  shapeWhy: string;
  directionsText: string;
  dirWhy: string;
  lensText: string;
  lensWhy: string;
  rowsText: string;
  published: boolean;
};

export const PRACTICE_DRAFT_HELP = {
  caseText: "Start a section with ## Heading, then one sentence per line.",
  recallText: "Q: The question\n* Correct option\nOther option",
  shapeText: "One option per line. Put * in front of the correct one.",
  directionsText: "One direction per line. Put * in front of directions the required actually asks for.",
  lensText: "One option per line. Put * in front of the correct lens.",
  rowsText: "id | direct or indirect or thinking | The mark point | clue-id | 1",
};

export function emptyPracticeDraft(): PracticeExerciseDraft {
  return {
    id: "",
    title: "",
    area: "Strategy",
    marks: "8",
    answer_minutes: "4",
    trains: "dir, lens, direct",
    required: "",
    caseText: "## 1 Background\nYou are a strategy consultant appointed by the board.\n",
    recallText: "Q: What kind of business is this?\n* A company in difficulty\nA listed bank\n",
    shapeText: "* A SWOT using the case facts\nA general essay\n",
    shapeWhy: "",
    directionsText: "* Use the case facts\nRecommend a board proposal\n",
    dirWhy: "",
    lensText: "* How each point affects going concern\nHow it affects customers\n",
    lensWhy: "",
    rowsText: "r1 | direct | Strength: name the case fact and why it matters | s1 | 1",
    published: true,
  };
}

export function slugifyExerciseId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function starredLines(text: string): { options: string[]; correct: number } {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const options = lines.map((line) => line.replace(/^\*\s*/, "").trim()).filter(Boolean);
  const correct = Math.max(0, lines.findIndex((line) => line.startsWith("*")));
  return { options, correct };
}

export function parseCaseText(text: string): CaseSection[] {
  const sections: CaseSection[] = [];
  let heading = "Case";
  let sentences: CaseSection["sentences"] = [];
  let n = 0;
  const flush = () => {
    if (!sentences.length) return;
    sections.push({ heading, sentences });
    sentences = [];
  };
  text.split("\n").forEach((raw) => {
    const line = raw.trim();
    if (!line) return;
    if (line.startsWith("##")) {
      flush();
      heading = line.replace(/^#+\s*/, "").trim() || heading;
      return;
    }
    n += 1;
    sentences.push({ id: `s${n}`, text: line, kind: null });
  });
  flush();
  return sections;
}

export function parseRecallText(text: string): RecallQuestion[] {
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  return blocks
    .map((block) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const question = lines[0]?.replace(/^Q:\s*/i, "").trim() || "";
      const optionLines = lines.slice(1);
      const { options, correct } = starredLines(optionLines.join("\n"));
      return { question, options, correct };
    })
    .filter((item) => item.question && item.options.length >= 2);
}

export function parseRowsText(text: string): MarkRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split("|").map((part) => part.trim());
      const proximity = parts[1] === "indirect" || parts[1] === "thinking" ? parts[1] : "direct";
      return {
        id: parts[0] || `r${index + 1}`,
        proximity: proximity as Proximity,
        point: parts[2] || "",
        clues: (parts[3] || "").split(/[,\s]+/).map((item) => item.trim()).filter(Boolean),
        marks: Number(parts[4] || 1) || 1,
      };
    })
    .filter((row) => row.point);
}

export function parseTrains(text: string): SkillKey[] {
  return text
    .split(/[,\s]+/)
    .map((item) => item.trim() as SkillKey)
    .filter((item) => SKILL_KEYS.has(item));
}

export function exerciseFromDraft(draft: PracticeExerciseDraft): { exercise?: DrillExercise; error?: string } {
  const id = (draft.id || slugifyExerciseId(draft.title)).trim();
  const title = draft.title.trim();
  const required = draft.required.trim();
  const caseSections = parseCaseText(draft.caseText);
  const recall = parseRecallText(draft.recallText);
  const shape = starredLines(draft.shapeText);
  const lens = starredLines(draft.lensText);
  const dirLines = draft.directionsText.split("\n").map((line) => line.trim()).filter(Boolean);
  const directions = {
    options: dirLines.map((line) => ({
      text: line.replace(/^\*\s*/, "").trim(),
      required: line.startsWith("*"),
    })),
    why: draft.dirWhy.trim(),
  };
  const rows = parseRowsText(draft.rowsText);
  if (!id) return { error: "Give the exercise an id or title." };
  if (!title) return { error: "Title is required." };
  if (!required) return { error: "The required is required." };
  if (!caseSections.length) return { error: "Add at least one case sentence." };
  if (recall.length < 1) return { error: "Add at least one recall question with two options." };
  if (shape.options.length < 2) return { error: "Add at least two Shape options and mark the correct one with *." };
  if (lens.options.length < 2) return { error: "Add at least two Lens options and mark the correct one with *." };
  if (directions.options.length < 2) return { error: "Add at least two Directions." };
  if (!rows.length) return { error: "Add at least one mark row." };
  return {
    exercise: {
      id,
      title,
      area: draft.area.trim() || "Practice",
      marks: Math.max(1, Number(draft.marks) || 8),
      answer_minutes: Math.max(1, Number(draft.answer_minutes) || 4),
      trains: parseTrains(draft.trains).length ? parseTrains(draft.trains) : ["dir", "direct"],
      case: caseSections,
      required,
      recall,
      rtfq: {
        shape: { ...shape, why: draft.shapeWhy.trim() },
        directions,
        lens: { ...lens, why: draft.lensWhy.trim() },
      },
      rows,
    },
  };
}

export function draftFromExercise(exercise: DrillExercise, published = true): PracticeExerciseDraft {
  const star = (options: string[], correct: number) =>
    options.map((option, index) => `${index === correct ? "* " : ""}${option}`).join("\n");
  return {
    id: exercise.id,
    title: exercise.title,
    area: exercise.area,
    marks: String(exercise.marks),
    answer_minutes: String(exercise.answer_minutes),
    trains: exercise.trains.join(", "),
    required: exercise.required,
    caseText: exercise.case
      .map((section) => `## ${section.heading}\n${section.sentences.map((sentence) => sentence.text).join("\n")}`)
      .join("\n\n"),
    recallText: exercise.recall
      .map((item) => `Q: ${item.question}\n${star(item.options, item.correct)}`)
      .join("\n\n"),
    shapeText: star(exercise.rtfq.shape.options, exercise.rtfq.shape.correct),
    shapeWhy: exercise.rtfq.shape.why || "",
    directionsText: exercise.rtfq.directions.options
      .map((option) => `${option.required ? "* " : ""}${option.text}`)
      .join("\n"),
    dirWhy: exercise.rtfq.directions.why || "",
    lensText: star(exercise.rtfq.lens.options, exercise.rtfq.lens.correct),
    lensWhy: exercise.rtfq.lens.why || "",
    rowsText: exercise.rows
      .map((row) => `${row.id} | ${row.proximity} | ${row.point} | ${row.clues.join(",")} | ${row.marks || 1}`)
      .join("\n"),
    published,
  };
}

export function asDrillExercise(raw: unknown): DrillExercise | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<DrillExercise>;
  if (!row.id || !row.title || !row.required || !Array.isArray(row.case) || !Array.isArray(row.recall) || !row.rtfq || !Array.isArray(row.rows)) {
    return null;
  }
  return row as DrillExercise;
}

function db() {
  return getServiceSupabase() || getSupabase();
}

export async function fetchPracticeExercises(options?: { includeDrafts?: boolean }): Promise<PracticeExerciseRow[]> {
  const client = db();
  if (!client) return [];
  let query = client.from("reading_practice_exercises").select("*").order("position", { ascending: true }).order("title", { ascending: true });
  if (!options?.includeDrafts) query = query.eq("published", true);
  const { data, error } = await query;
  if (error || !data) return [];
  return data
    .map((row) => {
      const payload = asDrillExercise(row.payload);
      if (!payload) return null;
      return {
        id: String(row.id),
        title: String(row.title || payload.title),
        area: String(row.area || payload.area || ""),
        published: row.published !== false,
        position: Number(row.position || 0),
        payload: { ...payload, id: String(row.id), title: String(row.title || payload.title) },
      };
    })
    .filter((row): row is PracticeExerciseRow => Boolean(row));
}

export async function fetchPracticeExercise(id: string): Promise<DrillExercise | null> {
  const client = db();
  if (client) {
    const { data } = await client.from("reading_practice_exercises").select("*").eq("id", id).maybeSingle();
    const payload = data ? asDrillExercise(data.payload) : null;
    if (payload && data) return { ...payload, id: String(data.id), title: String(data.title || payload.title) };
  }
  return getExercise(id);
}

export function mergePracticePool(builtIn: DrillExercise[], extras: DrillExercise[]): DrillExercise[] {
  const overrides = new Map(extras.filter((item) => item?.id).map((item) => [item.id, item]));
  const seen = new Set<string>();
  const merged: DrillExercise[] = [];
  for (const item of builtIn) {
    merged.push(overrides.get(item.id) || item);
    seen.add(item.id);
  }
  for (const item of extras) {
    if (!item?.id || seen.has(item.id)) continue;
    merged.push(item);
    seen.add(item.id);
  }
  return merged;
}

export async function listPracticePool(): Promise<DrillExercise[]> {
  const extra = await fetchPracticeExercises();
  return mergePracticePool(
    EXERCISES,
    extra.map((row) => row.payload)
  );
}
