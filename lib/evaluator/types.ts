/**
 * Script Evaluator v2 — types.
 *
 * Architecture (from the Eve vault): Pre-calibrated Question Model → Full Evaluation Dataset →
 * Synthesised Student Report. "Collect intensely; report lightly."
 *
 * Stage 1 outputs OBSERVATIONS only. Interpretation lives in Stage 2 and is always framed as a
 * working hypothesis with a probe, never as a root-cause diagnosis.
 */

export const COMMUNICATION_RATINGS = ["Complete", "Underdeveloped", "Unclear", "Miscommunicated"] as const;
export type CommunicationRating = (typeof COMMUNICATION_RATINGS)[number];

export const QUESTION_TYPES = ["Discussion", "Non-discussion"] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export type BmcrVerdict =
  | "no_basic_marks"
  | "not_enough_theory" // Basic marks < 50% of total marks
  | "enough_theory_converting" // Basic >= 50% of total and >= 70% of Basic marks converted
  | "enough_theory_not_converting"; // Basic >= 50% of total but < 70% converted ("something else", not theory)

export type ProximityItemEvidence = {
  /** Marker's report row number. */
  row: number;
  seen: boolean;
  awarded: boolean;
};

export const COMPONENT_SOURCES = ["required", "case_sections", "theory", "other"] as const;
export type ComponentSource = (typeof COMPONENT_SOURCES)[number];

/**
 * One layer of search-space structure: available -> recognised -> exploited, as counts.
 * Recognition needs evidence the student used the structure to hunt; generic topic talk does not count.
 */
export type ComponentLayer = {
  /** e.g. "SWOT buckets", "Case sections", "Goal 6 / Goal 7". */
  layer: string;
  source: ComponentSource;
  available: number;
  recognised: number;
  exploited: number;
  /** Super-brief: which ones, and the evidence. */
  note: string;
};

export type ComponentsEvidence = {
  layers: ComponentLayer[];
  evidence: string;
};

export type CoreIssueComponentEvidence = {
  layer: string;
  component: string;
  /** Pre-calibrated in the question model, never set by the evaluating model. "dominant" only when the case makes one obviously first. */
  priority: "dominant" | "higher" | "lower";
  clue_type: string;
  clue: string;
  /** Statements the student wrote on this component (Volume rule: one per statement). */
  attempts: number;
  depth: "none" | "surface" | "developed";
};

export type CoreIssueEvidence = {
  components: CoreIssueComponentEvidence[];
  /** Count of higher-priority components, dominant included. */
  higher_total: number;
  /** Higher-priority components (dominant included) with at least one attempt. */
  higher_covered: number;
  /** Null when the case shows no dominant component; otherwise whether the student wrote on it. */
  dominant_covered: boolean | null;
  /** Computed in code: all higher covered = aligned, some = partly, none = misaligned. Null when no higher components. */
  alignment: "aligned" | "partly" | "misaligned" | null;
  evidence: string;
};

export const RTFQ_DIMENSIONS = ["shape", "directions", "lens"] as const;
export type RtfqDimensionName = (typeof RTFQ_DIMENSIONS)[number];
export const RTFQ_DELIVERED = ["yes", "partly", "no"] as const;
export type RtfqDelivered = (typeof RTFQ_DELIVERED)[number];

/**
 * RTFQ: did the answer deliver what the required asked for? Subjective by nature, so "partly" is a first-class
 * outcome. It records delivery only, never why the student did or did not deliver.
 */
export type RtfqDimension = {
  dimension: RtfqDimensionName;
  /** What the required asked for on this dimension, in plain words. */
  required: string;
  delivered: RtfqDelivered;
  /** One line: the evidence on the page. */
  note: string;
};

export type RtfqEvidence = {
  dimensions: RtfqDimension[];
  evidence: string;
};

export type CommunicationPoint = {
  /** Same unit as Volume: one statement, in the order written. */
  n: number;
  /** Short quote or paraphrase so the coach can find it on the page. */
  statement: string;
  category: CommunicationRating;
  /** One line, only when it helps (e.g. "sentence stops mid-way"). */
  note: string;
};

/**
 * Communication judges only what made it onto the page. Point-level categories are kept for the coach and for
 * evidence; the student sees the trend sentence (plus a couple of examples), never counts.
 * A mark not awarded is NOT automatically a Communication problem.
 */
export type CommunicationEvidence = {
  points: CommunicationPoint[];
  /** Qualitative trend in plain words, no numbers or percentages. */
  trend: string;
  evidence: string;
};

export type ProximityBucket = {
  /** Marks of this proximity kind the official solution makes available. */
  available: number;
  /** Opportunities the candidate visibly saw/used (indicator), whether or not awarded. */
  seen: number;
  /** Marks actually awarded in this bucket. */
  awarded: number;
};

/** Page ranges are 1-based and refer to the stored PDF page numbers. */
export type RequirementPageMap = {
  code: string;
  label: string;
  script_pages: number[];
  report_pages: number[];
  /** Candidate wrote an answer for this requirement. */
  attempted: boolean;
  /** Mapping was by explicit label ("Required (d)") or by content matching. */
  mapped_by: "label" | "content" | "none";
  uncertain: boolean;
  note?: string;
};

export type PageMap = {
  requirements: RequirementPageMap[];
  /** Order the candidate actually answered in (labels). Never use sequence to assign requirements. */
  answer_order: string[];
};

export type BmcrRow = {
  code: string;
  available: number | null;
  student_known: number | null;
  /** Student's own calculation as written on the sheet, if present. */
  student_percentage: number | null;
};

export type RequirementEvaluation = {
  code: string;
  label: string;
  attempted: boolean;
  /** Official mark plan total for this requirement. */
  total_marks: number;
  /** Technical marks awarded per the marking report (PVAA marks separate). */
  technical_awarded: number | null;
  pvaa_awarded: number | null;
  question_type: QuestionType;
  question_type_basis: string;
  competency: { topic: string; basis: string };
  bmcr: { student_known: number | null; available: number | null };
  /** Item-level evidence against the pre-calibrated question model. Buckets are aggregated in code. */
  buried_treasure_items: ProximityItemEvidence[] | null;
  buried_treasure: { direct: ProximityBucket; indirect: ProximityBucket; thinking: ProximityBucket } | null;
  volume: { attempts: number; note: string } | null;
  components: ComponentsEvidence | null;
  core_issue: CoreIssueEvidence | null;
  rtfq: RtfqEvidence | null;
  communication: CommunicationEvidence | null;
  quick_comment: {
    /** Best-supported main thing between the student and the marks, or null if the evidence does not support one. */
    main_issue: string | null;
    certainty: "supported" | "uncertain";
    evidence: string;
  };
  uncertainties: string[];
};

/** Computed in code (never by the model). */
export type RequirementMetrics = {
  code: string;
  bmcr_conversion: number | null; // technical_awarded / student_known
  bmcr_verdict: BmcrVerdict;
  bmcr_known_pct: number | null; // student_known / total_marks
  actual_pct: number | null; // technical_awarded / total_marks
  accuracy: number | null; // technical_awarded / volume attempts
  proximity_conversion: { direct: number | null; indirect: number | null; thinking: number | null };
};

export type EvaluationDataset = {
  version: 1;
  attempt_id: string;
  sitting_id: string;
  paper_id: string;
  generated_at: string;
  model: string;
  page_map: PageMap;
  bmcr_rows: BmcrRow[];
  requirements: RequirementEvaluation[];
  metrics: RequirementMetrics[];
  source_notes: string[];
  warnings: string[];
};

export type ReportPattern = {
  /** Plain student-facing title. No theory jargon. */
  title: string;
  what_we_see: string;
  evidence: string[]; // references to requirements/measures, e.g. "Q1(a) Volume 7 attempts"
  why_it_matters: string;
  relevant_tool: string;
  /** Working hypotheses with the evidence that would confirm/reject them. Never presented as fact. */
  working_hypotheses: { hypothesis: string; would_confirm: string; would_reject: string }[];
  probe_question: string;
  next_step: string;
  confidence: "supported" | "tentative";
};

export type EvaluationReport = {
  version: 1;
  attempt_id: string;
  generated_at: string;
  model: string;
  headline: string;
  patterns: ReportPattern[];
  /** One line per requirement, "quick comment" style, derived from dataset. */
  requirement_comments: { code: string; comment: string; certainty: "supported" | "uncertain" }[];
  technical_gaps: string[];
  still_to_investigate: string[];
  /** Cues for the human coach. Never shown to the student. */
  coach_flags: { type: "wellbeing" | "quit_risk" | "data_quality" | "other"; note: string }[];
};

export type UsageTally = {
  input_tokens: number;
  output_tokens: number;
  calls: number;
};
