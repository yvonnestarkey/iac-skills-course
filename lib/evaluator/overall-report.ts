/**
 * Overall Report (Yvonne, 16 Oct 2026): the whole exam, pooled across the paper datasets.
 * Step 1 BMCR, Step 2 question type and competency pillar, Step 3 overall evaluation (signals), then the signals glossary.
 * Pure functions: no model calls. Rules set by Yvonne:
 * - Basic marks are capped at the requirement's Required Total before adding up (so one requirement cannot distort the total).
 * - Marks Earned is the mark report, including the professional marks (PVAAs). The student's own "what I got" is ignored.
 * - In Step 2 the professional marks are taken out of each requirement and totalled in their own row.
 * - A pillar under 35% is "High Risk".
 */
import { bmcrVerdict, BMCR_CONVERSION_THRESHOLD } from "./metrics";
import { pillarFor, pvaaMarksFor } from "./question-model";
import { OVERALL_STEPS, PILLARS, PVAA_ROW, SIGNALS_GLOSSARY } from "./report-text";
import { mdTable, num, pct } from "./report-format";
import { paperNumber, partKeyOf, partName, type ReportOptions } from "./student-report";
import { signalLines, TYPE_LABEL, typeKeyOf, type TypeKey } from "./signals";
import type { BmcrVerdict, EvaluationDataset, RequirementEvaluation } from "./types";

export const HIGH_RISK_BELOW = 0.35;
void BMCR_CONVERSION_THRESHOLD;

const VERDICT_TEXT: Record<BmcrVerdict, string> = {
  no_basic_marks: "No basic marks",
  not_enough_theory: "Not enough theory, not converting",
  enough_theory_converting: "Enough theory, converting",
  enough_theory_not_converting: "Enough theory, not converting",
};
// "Not enough theory" with good conversion cannot be told apart by bmcrVerdict (it stops at theory), so the text follows the sheet's own two flags.
function verdictText(earned: number, basic: number, total: number): string {
  const enough = total > 0 && basic / total >= 0.5;
  const converting = basic > 0 && earned / basic >= BMCR_CONVERSION_THRESHOLD;
  if (basic === 0) return VERDICT_TEXT.no_basic_marks;
  void bmcrVerdict;
  return `${enough ? "Enough theory" : "Not enough theory"}, ${converting ? "converting" : "not converting"}`;
}

const earnedOf = (r: RequirementEvaluation) => (r.technical_awarded ?? 0) + (r.pvaa_awarded ?? 0);
const basicOf = (r: RequirementEvaluation) => Math.min(r.bmcr.student_known ?? 0, r.total_marks);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

type Tot = { total: number; earned: number; basic: number };
const tot = (reqs: RequirementEvaluation[]): Tot => ({ total: sum(reqs.map((r) => r.total_marks)), earned: sum(reqs.map(earnedOf)), basic: sum(reqs.map(basicOf)) });
const bmcrRow = (label: string, t: Tot, bold = false): string[] => {
  const b = (s: string) => (bold ? `**${s}**` : s);
  return [b(label), b(num(t.total)), b(num(t.earned)), b(pct(t.earned, t.total)), b(num(t.basic)), b(pct(t.basic, t.total)), b(pct(t.earned, t.basic)), b(verdictText(t.earned, t.basic, t.total))];
};

function bmcrStep(datasets: EvaluationDataset[], o: ReportOptions): string[] {
  const s = OVERALL_STEPS.bmcr;
  const rows: string[][] = [];
  for (const d of datasets) {
    const n = paperNumber(d);
    rows.push([`**Paper ${n}${o.paperNames?.[n] ? ` - ${o.paperNames[n]}` : ""}**`, "", "", "", "", "", "", ""]);
    const parts = new Map<string, RequirementEvaluation[]>();
    for (const r of d.requirements) parts.set(partKeyOf(r.code), [...(parts.get(partKeyOf(r.code)) ?? []), r]);
    for (const [key, reqs] of parts) rows.push(bmcrRow(partName(key), tot(reqs)));
    rows.push(bmcrRow("Total", tot(d.requirements), true));
  }
  const exam = tot(datasets.flatMap((d) => d.requirements));
  rows.push(bmcrRow(`The exam (${datasets.length === 3 ? "three papers" : `${datasets.length} paper${datasets.length === 1 ? "" : "s"}`})`, exam, true));
  return [`## ${s.title}`, "", `**What it asks:** ${s.asks}`, "", `**Do it yourself:** ${s.how}`, "", ...mdTable(["", "Required Total", "Marks Earned", "% Earned", "Basic Marks", "% Basic", "% Knowledge Converted", "BMCR verdict"], rows), ""];
}

// ---- Step 2 ----
type Cut = { labels: string[]; earned: number; available: number };
const emptyCut = (): Cut => ({ labels: [], earned: 0, available: 0 });
const addCut = (c: Cut, r: RequirementEvaluation, paperId: string) => {
  c.labels.push(r.label);
  c.earned += r.technical_awarded ?? 0;
  c.available += r.total_marks - pvaaMarksFor(paperId, r.code);
};
const figure = (c: Cut) => (c.available ? `${num(c.earned)} of ${num(c.available)} (${pct(c.earned, c.available)})` : "-");
const examFigure = (c: Cut, highRisk: boolean) => (c.available ? `**${num(c.earned)} of ${num(c.available)} (${pct(c.earned, c.available)})${highRisk && c.earned / c.available < HIGH_RISK_BELOW ? " High Risk" : ""}**` : "-");

function typePillarStep(datasets: EvaluationDataset[], o: ReportOptions): string[] {
  const s = OVERALL_STEPS.type_pillar;
  const paperHead = datasets.map((d) => `Paper ${paperNumber(d)}`);
  const exam = (xs: Cut[]): Cut => xs.reduce((a, c) => ({ labels: [], earned: a.earned + c.earned, available: a.available + c.available }), emptyCut());
  // by type
  const typeRows: string[][] = [];
  for (const type of ["compliance", "non_compliance", "calculation"] as TypeKey[]) {
    const label = type === "compliance" ? "Discussion: compliance" : type === "non_compliance" ? "Discussion: non compliance" : "Calculation";
    const cuts = datasets.map((d) => {
      const c = emptyCut();
      for (const r of d.requirements.filter((x) => typeKeyOf(x) === type)) addCut(c, r, d.paper_id);
      return c;
    });
    const all = exam(cuts);
    typeRows.push([label, ...cuts.map((c) => (c.labels.length ? c.labels.join(", ") : "-")), ""]);
    typeRows.push(["", ...cuts.map(figure), examFigure(all, false)]);
  }
  // by pillar
  type PillarAgg = { name: string; weight: string; cuts: Cut[]; all: Cut };
  const aggs: PillarAgg[] = PILLARS.map((p) => {
    const cuts = datasets.map((d) => {
      const c = emptyCut();
      for (const r of d.requirements.filter((x) => pillarFor(d.paper_id, x.code) === p.name)) addCut(c, r, d.paper_id);
      return c;
    });
    return { name: p.name, weight: p.weight, cuts, all: exam(cuts) };
  }).filter((a) => a.all.available > 0);
  aggs.sort((a, b) => b.all.earned / b.all.available - a.all.earned / a.all.available);
  const examTotal = sum(datasets.flatMap((d) => d.requirements.map((r) => r.total_marks)));
  const pillarRows: string[][] = [];
  for (const a of aggs) {
    pillarRows.push([`${a.name} (${a.weight})`, pct(a.all.available, examTotal), ...a.cuts.map((c) => (c.labels.length ? c.labels.join(", ") : "-")), ""]);
    pillarRows.push(["", "", ...a.cuts.map(figure), examFigure(a.all, true)]);
  }
  // professional marks
  const pv = datasets.map((d) => {
    const c = emptyCut();
    for (const r of d.requirements) {
      const avail = pvaaMarksFor(d.paper_id, r.code);
      if (avail > 0) {
        c.labels.push(r.label);
        c.available += avail;
        c.earned += r.pvaa_awarded ?? 0;
      }
    }
    return c;
  });
  const pvAll = exam(pv);
  if (pvAll.available > 0) {
    pillarRows.push([`${PVAA_ROW.name} (${PVAA_ROW.weight})`, pct(pvAll.available, examTotal), ...pv.map((c) => (c.labels.length ? c.labels.join(", ") : "-")), ""]);
    pillarRows.push(["", "", ...pv.map(figure), examFigure(pvAll, true)]);
  }
  return [
    `## ${s.title}`, "", `**What it asks:** ${s.asks}`, "", `**Do it yourself:** ${s.how}`, "",
    "**Type of Question**", "", ...mdTable(["Type of question", ...paperHead, datasets.length === 3 ? "All three papers" : "All papers"], typeRows), "",
    "**By SAICA Competency Pillar** (best to weakest; the typical exam weighting is in brackets; question numbers in the first row)", "",
    ...mdTable(["SAICA exam pillar", "% of Exam", ...paperHead, "Exam Total"], pillarRows), "",
  ].join("\n").split("\n");
}

// ---- Step 3 ----
function evaluationStep(datasets: EvaluationDataset[]): string[] {
  const lines = signalLines(datasets);
  const warnings: string[][] = [];
  for (const d of datasets) {
    for (const r of d.requirements.filter((x) => !x.attempted)) {
      const reach = r.bmcr.student_known ?? 0;
      warnings.push([`Paper ${paperNumber(d)}`, `${r.label} not attempted (${num(r.total_marks)} marks${reach > 0 ? `, of which you believed ${num(Math.min(reach, r.total_marks))} were within reach` : ""}).`]);
    }
  }
  return [
    `## ${OVERALL_STEPS.evaluation.title}`, "", OVERALL_STEPS.evaluation.intro, "",
    ...mdTable(["Signal", "Tool", ...datasets.map((d) => `Paper ${paperNumber(d)}`), "Exam"], lines.map((l) => [l.signal, l.tool, ...l.papers, l.exam])), "",
    ...(warnings.length ? ["**Warning: Questions not attempted or not finished**", "", ...mdTable(["Paper", "Warning"], warnings), ""] : []),
  ];
}

export function buildOverallReport(datasets: EvaluationDataset[], options: ReportOptions = {}): string {
  const sorted = [...datasets].sort((a, b) => paperNumber(a) - paperNumber(b));
  return [
    `# ${options.studentName ?? "(Student name)"} ${options.sittingLabel ?? "June 2026"} Overall Report`,
    "",
    ...bmcrStep(sorted, options),
    ...typePillarStep(sorted, options),
    ...evaluationStep(sorted),
    SIGNALS_GLOSSARY,
    "",
  ].join("\n");
}

export { TYPE_LABEL };
