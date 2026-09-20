export const SYSTEMS_GUARDRAILS = [
  "Observation is not diagnosis.",
  "No diagnosis without behaviour or other evidence.",
  "Do not infer fixed mindset directly from behaviour.",
  "Preserve competing explanations and disconfirming evidence.",
  "Student self-diagnosis is evidence, not automatically truth.",
  "Do not assume technical knowledge is the problem, and do not assume it isn't.",
  "Basic/Average/Higher Grade knowledge accessibility is distinct from Direct/Indirect/Thinking case-study proximity.",
  "Automate analysis, not learning behaviours deliberately intended for the student to perform.",
  "An apparent exam technique may later prove psychological, behavioural, diagnostic, pedagogical, or several of these at once.",
] as const;

export const EPISTEMIC_RANK: Record<string, number> = {
  superseded: 0,
  ai_hypothesis: 1,
  source_observation: 2,
  research_supported: 3,
  contested: 3,
  unresolved_question: 3,
  yvonne_corrected: 4,
  yvonne_confirmed: 5,
};

export type SourceRef = {
  source_id: string;
  source_type?: string;
  location?: string;
  excerpt?: string;
};

export type RevisitItem = {
  source_id?: string;
  record_id?: string;
  reason: string;
};

export type WorkingStateBody = {
  current_checkpoint_id?: string | null;
  current_checkpoint_version?: string | null;
  traversal?: {
    last_source_id?: string | null;
    last_lesson_id?: string | null;
    position_note?: string;
  };
  examined_deeply?: { source_id: string; note?: string }[];
  scanned?: { source_id: string; note?: string }[];
  unresolved_question_ids?: string[];
  contradictions?: { summary: string; record_ids?: string[] }[];
  alternative_ids?: string[];
  yvonne_clarification_needed?: { question: string; record_id?: string }[];
  revisit_queue?: RevisitItem[];
  emerging_themes?: { theme: string; evidence_record_ids?: string[] }[];
  next_investigation?: string;
};

export function emptySystemsModel() {
  return {
    assumptions: [],
    observable_behaviours: [],
    learning_behaviours_created: [],
    psychological_mechanisms: [],
    diagnostic_mechanisms: [],
    pedagogical_mechanisms: [],
    sequencing: [],
    feedback_loops: [],
    mindset_strategy_skills: [],
    performance_evidence: [],
    interventions: [],
    function_by_position: [],
    recurring_across_coaching_and_course: [],
  };
}

export function emptyWorkingState(): WorkingStateBody {
  return {
    current_checkpoint_id: null,
    current_checkpoint_version: null,
    traversal: { last_source_id: null, last_lesson_id: null, position_note: "" },
    examined_deeply: [],
    scanned: [],
    unresolved_question_ids: [],
    contradictions: [],
    alternative_ids: [],
    yvonne_clarification_needed: [],
    revisit_queue: [],
    emerging_themes: [],
    next_investigation: "",
  };
}

export function mergeRevisitQueue(state: WorkingStateBody, items: RevisitItem[]): WorkingStateBody {
  const existing = state.revisit_queue || [];
  const merged = [...existing];
  for (const item of items) {
    const key = `${item.source_id || ""}:${item.record_id || ""}:${item.reason}`;
    if (merged.some((row) => `${row.source_id || ""}:${row.record_id || ""}:${row.reason}` === key)) continue;
    merged.push(item);
  }
  return { ...state, revisit_queue: merged };
}

export function currentLineageWinner<T extends { id: string; supersedes_id?: string | null; epistemic_status: string; lifecycle: string }>(
  records: T[]
): T[] {
  const byId = new Map(records.map((row) => [row.id, row]));
  const superseded = new Set(
    records.filter((row) => row.lifecycle === "superseded" || row.epistemic_status === "superseded").map((row) => row.id)
  );
  const winners: T[] = [];
  for (const row of records) {
    if (superseded.has(row.id) || row.lifecycle !== "active") continue;
    const previous = row.supersedes_id ? byId.get(row.supersedes_id) : null;
    if (previous && EPISTEMIC_RANK[row.epistemic_status] < EPISTEMIC_RANK[previous.epistemic_status] && previous.lifecycle === "active") {
      continue;
    }
    winners.push(row);
  }
  return winners.sort((left, right) => (EPISTEMIC_RANK[right.epistemic_status] || 0) - (EPISTEMIC_RANK[left.epistemic_status] || 0));
}

export function yvonneOutranks(status: string): boolean {
  return status === "yvonne_confirmed" || status === "yvonne_corrected";
}
