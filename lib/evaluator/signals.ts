/**
 * Signals for the Overall Report, Step 3 (Yvonne, 15 and 16 Oct 2026). Every rule is simple, non-discretionary and
 * computed from the evaluation dataset, so the same script always gives the same signals.
 */
import { PASS_SHARE, quantifier } from "./metrics";
import { componentRows, coreNotReached } from "./components-view";
import type { EvaluationDataset, RequirementEvaluation } from "./types";

/** A requirement-type line is added only when a type has this many attempted requirements and the signal shows in this share of them. */
export const COND_MIN = 3;
export const COND_SHARE = 0.75;

export type ReqSignals = {
  code: string;
  attempted: boolean;
  /** 50% or more of the Direct marks not earned (null = no Direct marks in this requirement). */
  direct: boolean | null;
  indirect: boolean | null;
  /** Shape, directions or lens not fully delivered (null = no RTFQ). */
  rtfq: boolean | null;
  volume: boolean | null;
  accuracy: boolean | null;
  /** A core component not looked at at all (null = no core component). */
  core: boolean | null;
  /** Underdeveloped points are Many or Most of the points (null = no communication evidence). */
  underdeveloped: boolean | null;
  /** Question type bucket, for the conditional RTFQ line. */
  type: TypeKey;
};

export type TypeKey = "compliance" | "non_compliance" | "calculation";
export const TYPE_LABEL: Record<TypeKey, string> = {
  compliance: "compliance discussion questions",
  non_compliance: "non-compliance discussion questions",
  calculation: "calculation questions",
};
export const typeKeyOf = (r: RequirementEvaluation): TypeKey => (r.question_type !== "Discussion" ? "calculation" : r.discussion_basis === "compliance" ? "compliance" : "non_compliance");

const notEarned = (b: { available: number; awarded: number } | undefined): boolean | null => (b && b.available > 0 ? b.awarded / b.available <= 1 - 0.5 : null);

export function requirementSignals(dataset: EvaluationDataset, r: RequirementEvaluation): ReqSignals {
  const none: ReqSignals = { code: r.code, attempted: r.attempted, direct: null, indirect: null, rtfq: null, volume: null, accuracy: null, core: null, underdeveloped: null, type: typeKeyOf(r) };
  if (!r.attempted) return none;
  const diag = dataset.metrics.find((m) => m.code === r.code)?.diagnoses;
  const comm = diag?.communication;
  const total = comm ? Object.entries(comm.counts).reduce((s, [k, v]) => s + (k === "Unreadable" ? 0 : v), 0) : 0;
  const q = comm && total > 0 ? quantifier(comm.counts.Underdeveloped / total) : null;
  return {
    ...none,
    direct: notEarned(r.buried_treasure?.direct),
    indirect: notEarned(r.buried_treasure?.indirect),
    rtfq: r.rtfq?.dimensions.length ? r.rtfq.dimensions.some((d) => d.delivered !== "yes") : null,
    volume: diag?.volume_accuracy ? diag.volume_accuracy.volume_signal : null,
    accuracy: diag?.volume_accuracy ? diag.volume_accuracy.accuracy_signal : null,
    core: coreNotReached(dataset.paper_id, r),
    underdeveloped: comm && total > 0 ? q === "Many" || q === "Most" : null,
  };
}

export type SignalLine = {
  signal: string;
  tool: string;
  /** Per paper (same order as the datasets) and for the exam. Strings so a conditional line can read "3 of 3" or "-". */
  papers: string[];
  exam: string;
};

const count = (xs: boolean[]) => xs.filter(Boolean).length;
const SIGNAL_TEXT = {
  direct: ["50% or more of the Direct marks not earned", "Buried Treasure"],
  indirect: ["50% or more of the Indirect marks not earned", "Buried Treasure"],
  rtfq: ["The shape, the instructions or the lens of the question not fully delivered", "RTFQ"],
  volume: [`Volume below ${PASS_SHARE * 100}%`, "Volume or Accuracy"],
  accuracy: [`Accuracy below ${PASS_SHARE * 100}%`, "Volume or Accuracy"],
  core: ["Not all core issues dealt with", "Components and Core Issue"],
  underdeveloped: ["Underdeveloped points", "Communication"],
} as const;

/** The Step 3 table: one row per signal, with a count of requirements per paper and for the exam. */
export function signalLines(datasets: EvaluationDataset[]): SignalLine[] {
  const perPaper = datasets.map((d) => d.requirements.map((r) => requirementSignals(d, r)));
  const all = perPaper.flat();
  const lines: SignalLine[] = [];
  lines.push({ signal: "Questions attempted", tool: "", papers: perPaper.map((p) => String(p.filter((s) => s.attempted).length)), exam: String(all.filter((s) => s.attempted).length) });
  const simple = (key: "direct" | "indirect" | "rtfq" | "volume" | "accuracy" | "core" | "underdeveloped") => {
    const f = (s: ReqSignals) => s[key] === true;
    lines.push({ signal: SIGNAL_TEXT[key][0], tool: SIGNAL_TEXT[key][1], papers: perPaper.map((p) => String(count(p.map(f)))), exam: String(count(all.map(f))) });
  };
  simple("direct");
  simple("indirect");
  simple("rtfq");
  // Conditional RTFQ line by type of question.
  for (const type of ["compliance", "non_compliance", "calculation"] as TypeKey[]) {
    const of = all.filter((s) => s.type === type && s.rtfq !== null);
    const hits = of.filter((s) => s.rtfq === true);
    if (of.length >= COND_MIN && hits.length / of.length >= COND_SHARE) {
      const text = (p: ReqSignals[]) => {
        const o = p.filter((s) => s.type === type && s.rtfq !== null);
        return o.length ? `${o.filter((s) => s.rtfq === true).length} of ${o.length}` : "-";
      };
      lines.push({ signal: `${SIGNAL_TEXT.rtfq[0]}. Specifically for ${TYPE_LABEL[type]}`, tool: "RTFQ", papers: perPaper.map(text), exam: `${hits.length} of ${of.length}` });
    }
  }
  simple("volume");
  simple("accuracy");
  simple("core");
  simple("underdeveloped");
  // Either Buried Treasure signal, out of the requirements that have Buried Treasure.
  const bt = (p: ReqSignals[]) => {
    const o = p.filter((s) => s.direct !== null || s.indirect !== null);
    return `${o.filter((s) => s.direct === true || s.indirect === true).length} of ${o.length}`;
  };
  lines.push({ signal: "Either Buried Treasure signal", tool: "Buried Treasure", papers: perPaper.map(bt), exam: bt(all) });
  return lines;
}

// re-export so a caller can show the Step 4 rows without importing two modules
export { componentRows };
