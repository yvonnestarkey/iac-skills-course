import june2026p1 from "@/lib/data/question-models/june-2026-p1.json";
import type { DiscussionBasis, QuestionType } from "./types";

export type Proximity = "direct" | "indirect" | "thinking";

export type ProximityItem = {
  /** Row number exactly as printed on the marker's report. Canonical reference for students and coach. */
  row: number;
  proximity: Proximity;
  /** The case clue (for Direct) or the bridge needed (for Indirect/Thinking). */
  note?: string;
};

export const CLUE_TYPES = ["breadth", "materiality", "topic_proximity", "density", "risk", "judgement", "low_relevance", "other"] as const;
export type ClueType = (typeof CLUE_TYPES)[number];

/**
 * Core Issue works on the Components, never on free-floating topics. For each component (a layer entry such as
 * a case section) the question model records whether the case signals it as a HIGHER or LOWER priority and the
 * clue a student could have seen in the exam. "dominant" is used ONLY when the case makes one component obviously
 * first (e.g. the valuation assertion when auditing consumable goods). Often there is no dominant one: several
 * components share the higher tier, as in Q1(a). Never force a ranking where the case does not show one.
 */
export type CoreIssueComponent = {
  /** Same layer name used in Components, e.g. "Case sections". */
  layer: string;
  component: string;
  priority: "dominant" | "higher" | "lower";
  clue_type: ClueType;
  /** The clue in plain words: why the case signals this weight. */
  clue: string;
};

export type RequirementModel = {
  question_type: QuestionType;
  /** Compliance (rules) or non_compliance (tools) for Discussion requirements; omitted until calibrated. */
  discussion_basis?: DiscussionBasis | null;
  proximity_items: ProximityItem[];
  core_issue?: CoreIssueComponent[];
};

type PaperModel = { paper_id: string; requirements: Record<string, RequirementModel> };

const MODELS: PaperModel[] = [june2026p1 as unknown as PaperModel];

/** Pre-calibrated Question Model lookup. Returns null when the requirement has not been modelled. */
export function questionModelFor(paperId: string, code: string): RequirementModel | null {
  return MODELS.find((model) => model.paper_id === paperId)?.requirements[code] ?? null;
}

export function proximityAvailable(model: RequirementModel | null): { direct: number; indirect: number; thinking: number } | null {
  if (!model || !model.proximity_items.length) return null;
  const counts = { direct: 0, indirect: 0, thinking: 0 };
  for (const item of model.proximity_items) counts[item.proximity] += 1;
  return counts;
}

/**
 * Which tools run, by question type (Yvonne, 6 Oct 2026):
 * Volume, Accuracy, Components and Core Issue run only on discussion questions. Calculation questions are
 * easy for students to self-diagnose; they are looked at briefly after the discussion tools are calibrated.
 * Until then, non-discussion requirements get BMCR, Question Type, Competency and the marker's marks only.
 */
export function toolsFor(questionType: QuestionType, attempted: boolean): {
  buriedTreasure: boolean;
  volumeAccuracy: boolean;
  components: boolean;
  coreIssue: boolean;
  rtfq: boolean;
  communication: boolean;
} {
  const none = { buriedTreasure: false, volumeAccuracy: false, components: false, coreIssue: false, rtfq: false, communication: false };
  if (!attempted || questionType !== "Discussion") return none;
  return { buriedTreasure: true, volumeAccuracy: true, components: true, coreIssue: true, rtfq: true, communication: true };
}
