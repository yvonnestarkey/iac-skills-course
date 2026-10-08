/**
 * Student report builder (Yvonne, 8 Oct 2026). Pure functions, no model calls.
 *
 * One report per Part per paper. Every Part uses the SAME eight steps in the SAME order, so a student can later repeat
 * the process on their own scripts. Tables are generated here from the evaluation dataset; the only model-written text
 * is the short "What it shows" line per step (passed in via `shows`). Steps 9 (Reading across) and 10 (What to work on)
 * are held as drafts until the full paper is done and are deliberately not built here.
 * Communication shows the diagnosis only (counts are coach-only).
 */
import { rtfqGate } from "./metrics";
import { toolsFor } from "./question-model";
import type { EvaluationDataset, RequirementEvaluation, RequirementMetrics } from "./types";

export const REPORT_STEPS = [
  "bmcr",
  "question_type",
  "rtfq",
  "buried_treasure",
  "volume_accuracy",
  "components",
  "core_issue",
  "communication",
] as const;
export type ReportStep = (typeof REPORT_STEPS)[number];

/** Key for a model-written "what it shows" line, e.g. "P1Q1:rtfq". */
export const showsKey = (partKey: string, step: ReportStep) => `${partKey}:${step}`;

const STEP_TEXT: Record<ReportStep, { title: string; asks: string; how: string }> = {
  bmcr: {
    title: "Basic marks vs converted marks (BMCR)",
    asks: "How many marks could you have earned from knowledge you already had, and how many of them did you convert?",
    how: "Before you start writing, list what you know for each requirement and add up the marks it is worth. After the marker's report, divide the marks you earned by the marks you thought you knew.",
  },
  question_type: {
    title: "Question type and topic",
    asks: "What kind of answer was each requirement asking for, and what topic does it test?",
    how: "Read the verbs. Discuss, explain or evaluate means a discussion; calculate or prepare means a calculation. Name the topic in two or three words.",
  },
  rtfq: {
    title: "Read the question (RTFQ)",
    asks: "Did your answer deliver what the requirement asked for: the shape, the directions and the lens?",
    how: "Underline what the requirement asks for before you write. Afterwards, check each one against your answer: yes, partly or no.",
  },
  buried_treasure: {
    title: "Buried treasure",
    asks: "How close to the case were the marks you could have earned, and which of them did you earn?",
    how: "Take each row of the marker's report. Ask how far the point sits from the information: stated in the case (Direct), one step away (Indirect), or built from your own thinking (Thinking). Then mark which rows you earned.",
  },
  volume_accuracy: {
    title: "Volume and accuracy",
    asks: "Did you write enough points, and were enough of them worth marks?",
    how: "Volume: count your statements and divide by the marks available. Accuracy: divide the marks you earned by your statements. Multiply the two to see the share of the marks you earned.",
  },
  components: {
    title: "Components",
    asks: "What parts did the question and the case give you to hunt in, and how many did you find and use?",
    how: "List the parts on offer (for example the headings in the requirement, the sections of the case, the theory you need). Tick the ones your answer found, then the ones you developed.",
  },
  core_issue: {
    title: "Core issue",
    asks: "Which parts of the case deserved the most of your time, and does your answer show it?",
    how: "Look for the parts the case signals as bigger (more detail, more money, more risk, named in the requirement). Then check how much of your answer sits on them.",
  },
  communication: {
    title: "Communication",
    asks: "Was each point clear and finished, so that a marker could give the mark?",
    how: "Read your answer back one statement at a time. Is it complete, underdeveloped (a thought left unfinished), unclear, or does it say something different from what you meant?",
  },
};

const BMCR_VERDICT: Record<RequirementMetrics["bmcr_verdict"], string> = {
  no_basic_marks: "No basic marks counted",
  not_enough_theory: "Not enough basic marks known",
  enough_theory_converting: "Basic marks known and converted",
  enough_theory_not_converting: "Basic marks known, but not converted",
};

const pct = (value: number | null | undefined) => (value === null || value === undefined ? "—" : `${Math.round(value * 100)}%`);
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];

/** "P1Q2_e" -> "P1Q2". */
export const partKeyOf = (code: string) => code.split("_")[0];

/** "P1Q2" -> "Paper 1 · Part II". */
export function partTitle(partKey: string): string {
  const m = /^P(\d+)Q(\d+)$/.exec(partKey);
  return m ? `Paper ${m[1]} · Part ${ROMAN[Number(m[2])] ?? m[2]}` : partKey;
}

export function groupByPart(dataset: EvaluationDataset): { key: string; title: string; requirements: RequirementEvaluation[] }[] {
  const parts = new Map<string, RequirementEvaluation[]>();
  for (const req of dataset.requirements) {
    const key = partKeyOf(req.code);
    parts.set(key, [...(parts.get(key) ?? []), req]);
  }
  return [...parts.entries()].map(([key, requirements]) => ({ key, title: partTitle(key), requirements }));
}

const metricsFor = (dataset: EvaluationDataset, code: string) => dataset.metrics.find((m) => m.code === code);
const cell = (value: string | number | null | undefined) => String(value ?? "—").replace(/\|/g, "/").replace(/\n/g, " ");
const row = (cells: (string | number | null | undefined)[]) => `| ${cells.map(cell).join(" | ")} |`;

function section(step: ReportStep, n: number, body: string[], shows: string | undefined): string[] {
  const t = STEP_TEXT[step];
  const lines = [`### Step ${n}: ${t.title}`, "", `**What it asks:** ${t.asks}`, "", `**How to do it yourself:** ${t.how}`, "", "**Your result:**", "", ...body];
  if (shows) lines.push("", `**What it shows:** ${shows}`);
  return [...lines, ""];
}

/** One Part's report in Markdown. `shows` holds the model-written one-liners keyed by showsKey(). */
export function buildPartReport(
  dataset: EvaluationDataset,
  part: { key: string; title: string; requirements: RequirementEvaluation[] },
  shows: Record<string, string> = {}
): string {
  const reqs = part.requirements;
  const lines: string[] = [`## ${part.title}`, ""];
  const show = (step: ReportStep) => shows[showsKey(part.key, step)];
  const tools = (r: RequirementEvaluation) => toolsFor(r.question_type, r.attempted);

  // 1 BMCR
  {
    const body = ["| Requirement | Marks available | Basic marks you knew | Basic as % of marks | Marks earned | Basic marks converted | Result |", "|---|---|---|---|---|---|---|"];
    for (const r of reqs) {
      const m = metricsFor(dataset, r.code);
      body.push(row([r.label, r.total_marks, r.bmcr.student_known, pct(m?.bmcr_known_pct), r.technical_awarded, pct(m?.bmcr_conversion), m ? BMCR_VERDICT[m.bmcr_verdict] : "—"]));
    }
    lines.push(...section("bmcr", 1, body, show("bmcr")));
  }
  // 2 Question type and topic
  {
    const body = ["| Requirement | Question type | Discussion style | Topic |", "|---|---|---|---|"];
    for (const r of reqs) body.push(row([r.label, r.question_type, r.discussion_basis ? (r.discussion_basis === "compliance" ? "Rules" : "Tools") : "—", r.competency.topic]));
    lines.push(...section("question_type", 2, body, show("question_type")));
  }
  // 3 RTFQ (every attempted requirement)
  {
    const body: string[] = [];
    for (const r of reqs.filter((x) => tools(x).rtfq && x.rtfq?.dimensions.length)) {
      const misread = rtfqGate(r.rtfq) === "misread";
      body.push(`**${r.label}**${misread ? ": you earned little here because the question was misread, but the steps below show what you can do when you read it properly." : ""}`, "", "| Dimension | What the question asked for | Delivered? | Note |", "|---|---|---|---|");
      for (const d of r.rtfq!.dimensions) body.push(row([d.dimension, d.required, d.delivered, d.note]));
      body.push("");
    }
    lines.push(...section("rtfq", 3, body.length ? body : ["Not attempted."], show("rtfq")));
  }
  // 4 Buried treasure
  {
    const body = ["| Requirement | Direct (available / earned) | Indirect (available / earned) | Thinking (available / earned) |", "|---|---|---|---|"];
    for (const r of reqs.filter((x) => tools(x).buriedTreasure && x.buried_treasure)) {
      const b = r.buried_treasure!;
      body.push(row([r.label, `${b.direct.available} / ${b.direct.awarded}`, `${b.indirect.available} / ${b.indirect.awarded}`, `${b.thinking.available} / ${b.thinking.awarded}`]));
    }
    lines.push(...section("buried_treasure", 4, body.length > 2 ? body : ["Not applicable to this Part."], show("buried_treasure")));
  }
  // 5 Volume and accuracy (stated together, then concluded)
  {
    const body = ["| Requirement | Volume | Accuracy | Share of marks earned | Conclusion |", "|---|---|---|---|---|"];
    for (const r of reqs.filter((x) => tools(x).volumeAccuracy)) {
      const va = metricsFor(dataset, r.code)?.diagnoses?.volume_accuracy;
      if (va) body.push(row([r.label, pct(va.volume), pct(va.accuracy), pct(va.combined), va.text]));
    }
    lines.push(...section("volume_accuracy", 5, body.length > 2 ? body : ["Not applicable to this Part."], show("volume_accuracy")));
  }
  // 6 Components
  {
    const body: string[] = [];
    for (const r of reqs.filter((x) => tools(x).components && x.components?.layers.length)) {
      body.push(`**${r.label}**`, "", "| Layer | Available | Found | Developed | Note |", "|---|---|---|---|---|");
      for (const l of r.components!.layers) body.push(row([l.layer, l.available, l.recognised, l.exploited, l.note]));
      body.push("");
    }
    lines.push(...section("components", 6, body.length ? body : ["Not applicable to this Part."], show("components")));
  }
  // 7 Core issue: core issues first, then the student's detail, then whether the answer reflects them
  {
    const body: string[] = [];
    for (const r of reqs.filter((x) => tools(x).coreIssue && x.core_issue?.components.length)) {
      const d = metricsFor(dataset, r.code)?.diagnoses?.core_issue;
      body.push(`**${r.label}**`, "");
      if (d) body.push(d.core_issues_text, "");
      body.push("| Component | Priority | Clue the case gave | Your statements | Depth |", "|---|---|---|---|---|");
      for (const c of r.core_issue!.components) body.push(row([c.component, c.priority, c.clue, c.attempts, c.depth]));
      if (d) body.push("", d.reflection_text);
      if (r.core_issue!.off_plan_note) body.push("", `Points outside the mark plan are not wrong; they show where you expanded or contracted differently from the case: ${r.core_issue!.off_plan_note}`);
      body.push("");
    }
    lines.push(...section("core_issue", 7, body.length ? body : ["Not applicable to this Part."], show("core_issue")));
  }
  // 8 Communication: diagnosis only, never counts
  {
    const body: string[] = [];
    for (const r of reqs.filter((x) => tools(x).communication)) {
      const d = metricsFor(dataset, r.code)?.diagnoses?.communication;
      if (d) body.push(`- **${r.label}:** ${d.text}`);
    }
    lines.push(...section("communication", 8, body.length ? body : ["Not applicable to this Part."], show("communication")));
  }
  return lines.join("\n");
}

/** All Parts, in paper order. */
export function buildStudentReports(dataset: EvaluationDataset, shows: Record<string, string> = {}): { key: string; title: string; markdown: string }[] {
  return groupByPart(dataset).map((part) => ({ key: part.key, title: part.title, markdown: buildPartReport(dataset, part, shows) }));
}
