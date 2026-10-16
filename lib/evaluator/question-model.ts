import june2026p1 from "@/lib/data/question-models/june-2026-p1.json";
import june2026p2 from "@/lib/data/question-models/june-2026-p2.json";
import june2026p3 from "@/lib/data/question-models/june-2026-p3.json";
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

/**
 * One node of a layered Components tree (Yvonne, 9 and 12 Oct 2026). `path` runs Layer 1 > Layer 2 > Layer 3
 * (shorter paths are fine). Components are triggers for valid points: "what do I need to think of here?".
 */
export type ComponentNode = {
  path: string[];
  label: string;
  /** required: named in the requirement; case: a fact or event in the case; theory: from a standard, act or framework. */
  source: "required" | "case" | "theory";
  /** Could the student reach it with the basic theory? False = beyond the basics: listed, never counted as missed. */
  basic_theory: boolean;
  /** Reference to the official solution item, e.g. "3.1". */
  solution_ref: string;
  /** "cpc": a Code of Professional Conduct issue, checked against the whole chain (indicator, threat, principle, explanation, significance, safeguard). */
  chain?: "cpc";
  /** Carried over from another requirement; still a real opportunity (the exam splits one discussion). */
  contingent?: boolean;
  /** Marks this node carries in the marker's report (technical marks), where recorded. */
  marks?: number;
  note?: string;
};

export type RequirementModel = {
  question_type: QuestionType;
  /** Compliance (rules) or non_compliance (tools) for Discussion requirements; omitted until calibrated. */
  discussion_basis?: DiscussionBasis | null;
  proximity_items: ProximityItem[];
  core_issue?: CoreIssueComponent[];
  component_tree?: ComponentNode[];
  /** Marks the suggested solution makes available per component (capped where the solution states a maximum), against the requirement's technical maximum. Core Issue is decided from this volume of marks. */
  core_marks?: { max: number; components: { label: string; marks: number }[] };
  /** SAICA competency pillar, pre-calibrated (Yvonne, 14 Oct 2026). One of the names in report-text.ts PILLARS. */
  pillar?: string;
  /** Professional (PVAA) marks inside this requirement's mark-plan total. They are taken out of the requirement for the type and pillar tables and totalled in their own row. */
  pvaa_marks?: number;
};

type PaperModel = { paper_id: string; requirements: Record<string, RequirementModel> };

const MODELS: PaperModel[] = [june2026p1 as unknown as PaperModel, june2026p2 as unknown as PaperModel, june2026p3 as unknown as PaperModel];

/** Pre-calibrated Question Model lookup. Returns null when the requirement has not been modelled. */
export function questionModelFor(paperId: string, code: string): RequirementModel | null {
  return MODELS.find((model) => model.paper_id === paperId)?.requirements[code] ?? null;
}

export const pillarFor = (paperId: string, code: string) => questionModelFor(paperId, code)?.pillar ?? null;
export const pvaaMarksFor = (paperId: string, code: string) => questionModelFor(paperId, code)?.pvaa_marks ?? 0;

export function proximityAvailable(model: RequirementModel | null): { direct: number; indirect: number; thinking: number } | null {
  if (!model || !model.proximity_items.length) return null;
  const counts = { direct: 0, indirect: 0, thinking: 0 };
  for (const item of model.proximity_items) counts[item.proximity] += 1;
  return counts;
}

/**
 * A component is a core issue when it is weighted more heavily than its neighbours: the marks available from it
 * (capped where the solution states a maximum) are more than this many. A student aims for about three points
 * per component, so a component worth more than three marks carries more than its fair share
 * (Yvonne, 12 Oct 2026: draft constant, "more than three marks for now"; to be reviewed once it has been run on more questions).
 */
/**
 * A component is core when it carries at least this many marks more than its fair share. Fair share is the question's
 * total (the cap, not the plan's available marks) divided by the number of components, rounded to the nearest whole mark
 * (Yvonne, 12 Oct 2026: "if the core is that close, make it core"; a student plans in whole points).
 */
export const CORE_EXTRA_MARKS = 3;
export function coreComponents(model: RequirementModel | null): { label: string; marks: number; fair: number; core: boolean }[] | null {
  const cm = model?.core_marks;
  if (!cm || !cm.max || cm.components.length === 0) return null;
  const fair = Math.round(cm.max / cm.components.length);
  return cm.components.map((c) => ({ label: c.label, marks: c.marks, fair, core: c.marks - fair >= CORE_EXTRA_MARKS }));
}

/** Counts for a layered Components tree. Only basic-theory nodes count as available; the rest are "beyond the basics". */
export function componentTreeSummary(model: RequirementModel | null): {
  available: number;
  beyond_basics: number;
  cpc_issues: number;
  by_layer1: { layer1: string; available: number; beyond_basics: number }[];
} | null {
  const tree = model?.component_tree;
  if (!tree || !tree.length) return null;
  const order: string[] = [];
  const map = new Map<string, { available: number; beyond_basics: number }>();
  let available = 0;
  let beyond = 0;
  let cpc = 0;
  for (const node of tree) {
    const key = node.path[0];
    if (!map.has(key)) {
      map.set(key, { available: 0, beyond_basics: 0 });
      order.push(key);
    }
    const entry = map.get(key)!;
    if (node.basic_theory) {
      entry.available += 1;
      available += 1;
      if (node.chain === "cpc") cpc += 1;
    } else {
      entry.beyond_basics += 1;
      beyond += 1;
    }
  }
  return { available, beyond_basics: beyond, cpc_issues: cpc, by_layer1: order.map((layer1) => ({ layer1, ...map.get(layer1)! })) };
}

/**
 * Which tools run, by question type (Yvonne, 6 Oct 2026):
 * Volume, Accuracy, Components and Core Issue run only on discussion questions. Calculation questions are
 * easy for students to self-diagnose; they are looked at briefly after the discussion tools are calibrated.
 * Until then, non-discussion requirements get BMCR, Question Type, Competency, RTFQ and the marker's marks only.
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
  if (!attempted) return none;
  // RTFQ runs on EVERY attempted requirement (Yvonne, 8 Oct 2026): a student who misread the question, e.g. wrote a
  // calculation where a discussion was required, makes every other tool's reading provisional.
  // Calculations also get Buried Treasure and Components (their core issue and Coverage x Accuracy come from the component marks); 16 Oct 2026.
  if (questionType !== "Discussion") return { ...none, rtfq: true, buriedTreasure: true, components: true };
  return { buriedTreasure: true, volumeAccuracy: true, components: true, coreIssue: true, rtfq: true, communication: true };
}
