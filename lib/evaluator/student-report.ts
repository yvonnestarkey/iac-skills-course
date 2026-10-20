/**
 * Per Paper Report (Yvonne, 16 Oct 2026). Pure functions, no model calls: every table is built from the evaluation
 * dataset and all other text is fixed wording from report-text.ts. Five steps, same order for every paper:
 * 1 RTFQ, 2 Buried Treasure, 3 Volume and Accuracy, 4 Components and Core Issue, 5 Communication.
 * Tables only: there are no model-written lines under the tables. The whole-exam steps are in overall-report.ts.
 */
import { componentRows } from "./components-view";
import {
  COMMUNICATION_DEFINITIONS,
  COMMUNICATION_KEY,
  PAPER_HOW_TO_READ,
  PAPER_STEPS,
  type PaperStepKey,
} from "./report-text";
import { cap1, mdTable, num, pct } from "./report-format";
import type { EvaluationDataset, RequirementEvaluation } from "./types";

export const REPORT_STEPS: PaperStepKey[] = PAPER_STEPS.map((s) => s.key);

const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

/** "P1Q2_e" -> "P1Q2". */
export const partKeyOf = (code: string) => code.split("_")[0];
/** "P1Q2" -> "Part II". */
export const partName = (partKey: string) => {
  const m = /^P\d+Q(\d+)$/.exec(partKey);
  return m ? `Part ${ROMAN[Number(m[1])] ?? m[1]}` : partKey;
};
/** "iac-2026-p1" -> 1. */
export const paperNumber = (dataset: EvaluationDataset) => Number(/p(\d+)$/.exec(dataset.paper_id)?.[1] ?? 0);

export type ReportOptions = {
  /** The course inserts the real name; the placeholder is kept in the text so it can be replaced. */
  studentName?: string;
  /** e.g. "June 2026". */
  sittingLabel?: string;
  /** e.g. { 1: "Inpahla" } for the header "Paper 1, Inpahla". */
  paperNames?: Record<number, string>;
  /** Requirement titles by code, for the headings in Step 4 (the question's own wording). */
  titles?: Record<string, string>;
};

/** The line at the top of every report: the student and the sitting (Yvonne, 20 Oct 2026). Rendered small, above the title. */
export const documentHeader = (o: ReportOptions = {}) => `###### ${o.studentName ?? "(Student name)"} · ${o.sittingLabel ?? "June 2026"}`;

/** The big red title of a Per Paper Report, e.g. "Paper 1: Inpahla". */
export const reportHeader = (dataset: EvaluationDataset, o: ReportOptions = {}) =>
  `Paper ${paperNumber(dataset)}${o.paperNames?.[paperNumber(dataset)] ? `: ${o.paperNames[paperNumber(dataset)]}` : ""}`;

export function groupByPart(dataset: EvaluationDataset): { key: string; title: string; requirements: RequirementEvaluation[] }[] {
  const parts = new Map<string, RequirementEvaluation[]>();
  for (const req of dataset.requirements) parts.set(partKeyOf(req.code), [...(parts.get(partKeyOf(req.code)) ?? []), req]);
  return [...parts.entries()].map(([key, requirements]) => ({ key, title: partName(key), requirements }));
}

const typeNote = (r: RequirementEvaluation) =>
  r.question_type !== "Discussion" ? "non-discussion: calculation" : r.discussion_basis === "compliance" ? "discussion: compliance" : "discussion: non-compliance";
const metricsFor = (dataset: EvaluationDataset, code: string) => dataset.metrics.find((m) => m.code === code);

function stepHeader(key: PaperStepKey): string[] {
  const s = PAPER_STEPS.find((x) => x.key === key)!;
  return [`## ${s.title}`, "", `**What it asks:** ${s.asks}`, "", `**Do it yourself:** ${s.how}`, ""];
}

/** Step 1: three dimensions per attempted requirement. */
function rtfqStep(parts: ReturnType<typeof groupByPart>): string[] {
  const out = stepHeader("rtfq");
  for (const part of parts) {
    out.push(`### ${part.title}`, "");
    for (const r of part.requirements) {
      out.push(`**${r.label}**`, "");
      if (!r.attempted) out.push("Not attempted", "");
      else if (!r.rtfq?.dimensions.length) out.push("-", "");
      else out.push(...mdTable(["Dimension", "What the question asked for", "Delivered?", "Note"], r.rtfq.dimensions.map((d) => [cap1(d.dimension), d.required, cap1(d.delivered), d.note])), "");
    }
  }
  return out;
}

/** Step 2: earned of available at three distances. */
function buriedStep(parts: ReturnType<typeof groupByPart>): string[] {
  const out = stepHeader("buried_treasure");
  for (const part of parts) {
    const rows: (string | number)[][] = [];
    for (const r of part.requirements) {
      if (!r.attempted) rows.push([r.label, "not attempted", "", ""]);
      else if (r.buried_treasure) {
        const b = r.buried_treasure;
        const f = (x: { available: number; awarded: number }) => (x.available > 0 ? `${num(x.awarded)} of ${num(x.available)}` : "none available");
        rows.push([r.label, f(b.direct), f(b.indirect), f(b.thinking)]);
      }
    }
    if (rows.length) out.push(`### ${part.title}`, "", ...mdTable(["Requirement", "Direct (earned of available)", "Indirect", "Thinking"], rows), "");
  }
  return out;
}

/** Marks in a requirement's components, for Coverage and Accuracy on calculations. */
function coverage(dataset: EvaluationDataset, r: RequirementEvaluation) {
  const rows = componentRows(dataset.paper_id, r);
  if (!rows) return null;
  const available = rows.reduce((s, c) => s + c.marks_available, 0);
  const attempted = rows.filter((c) => c.recognised !== "no").reduce((s, c) => s + c.marks_available, 0);
  return { available, attempted, earned: r.technical_awarded ?? 0 };
}

/** Step 3: volume points for discussions; coverage for calculations. */
function volumeStep(dataset: EvaluationDataset, parts: ReturnType<typeof groupByPart>): string[] {
  const out = stepHeader("volume_accuracy");
  for (const part of parts) {
    const disc: (string | number)[][] = [];
    const calc: (string | number)[][] = [];
    for (const r of part.requirements.filter((x) => x.attempted)) {
      const va = metricsFor(dataset, r.code)?.diagnoses?.volume_accuracy;
      if (va && r.volume) disc.push([r.label, num(r.total_marks), r.volume.attempts, pct(va.volume, 1), num(r.technical_awarded), va.accuracy === null ? "-" : pct(va.accuracy, 1)]);
      else if (r.question_type !== "Discussion") {
        const c = coverage(dataset, r);
        if (c) calc.push([r.label, num(c.available), num(c.attempted), pct(c.attempted, c.available), num(c.earned), pct(c.earned, c.attempted)]);
      }
    }
    if (!disc.length && !calc.length) continue;
    out.push(`### ${part.title}`, "");
    // Same two tables, same captions and same columns in every part of every paper. No combined column: Volume and Accuracy are
    // separate signals, and a requirement low on both is simply a problem on both (Yvonne, 20 Oct 2026).
    if (disc.length) out.push("**Discussion questions (Volume and Accuracy)**", "", ...mdTable(["Requirement", "Total", "Volume points", "Volume", "Marks earned", "Accuracy"], disc), "");
    if (calc.length) out.push("**Calculation questions (Coverage and Accuracy)**", "", ...mdTable(["Requirement", "Marks available", "Marks in the components you attempted", "Coverage", "Marks earned", "Accuracy"], calc), "");
  }
  return out;
}

const YN = { yes: "Yes", partly: "Partly", no: "No" } as const;

/** Step 4: component rows per requirement, with the Code chain where the tree has one. */
function componentsStep(dataset: EvaluationDataset, parts: ReturnType<typeof groupByPart>, titles: Record<string, string>): string[] {
  const out = stepHeader("components");
  for (const part of parts) {
    const blocks: string[] = [];
    for (const r of part.requirements.filter((x) => x.attempted)) {
      const rows = componentRows(dataset.paper_id, r);
      if (!rows) continue;
      const depth = Math.max(0, ...rows.map((c) => c.layers.length));
      const head = [...Array.from({ length: depth }, (_, i) => `Layer ${i + 1}`), depth ? `Layer ${depth + 1}` : "Layer 1", "Marks available", "Marks earned", "Recognised", "Exploited", "Core issue", "Core issue recognised"];
      let prev: string[] = [];
      const body = rows.map((c) => {
        const cols = Array.from({ length: depth }, (_, i) => (c.layers[i] && c.layers[i] !== prev[i] ? c.layers[i] : ""));
        prev = c.layers;
        return [...cols, c.label, num(c.marks_available), num(c.marks_earned), YN[c.recognised], YN[c.exploited], c.core ? "Yes" : "No", c.core_recognised ? YN[c.core_recognised] : "-"];
      });
      const core = rows.filter((c) => c.core);
      const total = rows.reduce((s, c) => s + c.marks_available, 0);
      const earned = rows.some((c) => c.marks_earned !== null) ? rows.reduce((s, c) => s + (c.marks_earned ?? 0), 0) : null;
      body.push([
        ...Array.from({ length: depth }, () => ""),
        `**Components (${rows.length})**`,
        `**${num(total)}**`,
        earned === null ? "-" : `**${num(earned)}**`,
        `**${rows.filter((c) => c.recognised !== "no").length} looked at**`,
        `**${rows.filter((c) => c.exploited !== "no").length} earned from**`,
        `**${core.length} core**`,
        core.length ? `**${core.filter((c) => c.core_recognised !== "no").length} of ${core.length} looked at**` : "-",
      ]);
      blocks.push(`**${r.label}${titles[r.code] ? `: ${titles[r.code]}` : ""}** *(${typeNote(r)})*`, "", ...mdTable(head, body), "");
      if (r.components?.code_chain?.length) {
        const mark = (v: string) => (v === "yes" ? "✓" : v === "partly" ? "~" : "✗");
        blocks.push("*Code chain: ✓ = dealt with, ~ = partly, ✗ = missing.*", "", ...mdTable(["Code issue in your answer", "Indicator", "Threat", "Principle", "Explanation", "Significance", "Safeguard"], r.components.code_chain.map((i) => [i.issue, mark(i.indicator), mark(i.threat), mark(i.principle), mark(i.explanation), mark(i.significance), mark(i.safeguard)])), "");
      }
    }
    if (blocks.length) out.push(`### ${part.title}`, "", ...blocks);
  }
  return out;
}

/** Step 5: the diagnosis sentence per requirement (never the counts). */
function communicationStep(dataset: EvaluationDataset, parts: ReturnType<typeof groupByPart>): string[] {
  const out = stepHeader("communication").slice(0, -1);
  out.push(...COMMUNICATION_DEFINITIONS.map(([k, v]) => `- **${k}:** ${v}`), "", COMMUNICATION_KEY, "");
  for (const part of parts) {
    const rows: string[][] = [];
    for (const r of part.requirements.filter((x) => x.attempted)) {
      const d = metricsFor(dataset, r.code)?.diagnoses?.communication;
      if (d) rows.push([r.label, `**${d.text}**`]);
    }
    if (rows.length) out.push(`### ${part.title}`, "", ...mdTable(["Requirement", "Diagnosis"], rows), "");
  }
  return out;
}

/** One paper's report in Markdown. */
export function buildPaperReport(dataset: EvaluationDataset, options: ReportOptions = {}): string {
  const parts = groupByPart(dataset);
  return [
    documentHeader(options),
    "",
    `# ${reportHeader(dataset, options)}`,
    "",
    "## How to read this report",
    "",
    PAPER_HOW_TO_READ,
    "",
    ...rtfqStep(parts),
    ...buriedStep(parts),
    ...volumeStep(dataset, parts),
    ...componentsStep(dataset, parts, options.titles ?? {}),
    ...communicationStep(dataset, parts),
  ].join("\n");
}
