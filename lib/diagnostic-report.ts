export const KNOWLEDGE_WEIGHT = 0.35;
export const APPLICATION_WEIGHT = 0.65;

export type PrimaryBlocker = "theory" | "execution" | "both";

export type DiagnosticQuestionInput = {
  question_code: string;
  tier1_earned: number;
  tier1_available: number;
  tier2_earned: number;
  tier2_available: number;
};

export type DiagnosticQuestion = DiagnosticQuestionInput & {
  available_marks: number;
  knowledge_earned_pct: number;
  application_earned_pct: number;
  question_total: number;
  question_total_pct: number;
  got_right: string[];
  lost_marks: string[];
};

export type DiagnosticReport = {
  paper_name: string;
  question_code: string;
  student_notes: string;
  tier1_earned: number;
  tier1_available: number;
  tier2_earned: number;
  tier2_available: number;
  total_score_pct: number;
  knowledge_pct: number;
  application_pct: number;
  knowledge_summary: string;
  application_summary: string;
  primary_blocker: PrimaryBlocker;
  core_verdict: string;
  questions: DiagnosticQuestion[];
  skill_drills: string[];
};

export type DiagnosticReportResult = DiagnosticReport & {
  id?: string;
  created_at?: string;
  sources?: { title: string; category: string; similarity: number }[];
};

export const diagnosticReportSchema = {
  name: "diagnostic_report",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      knowledge_summary: { type: "string" },
      application_summary: { type: "string" },
      primary_blocker: { type: "string", enum: ["theory", "execution", "both"] },
      core_verdict: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            question_code: { type: "string" },
            got_right: { type: "array", items: { type: "string" } },
            lost_marks: { type: "array", items: { type: "string" } },
          },
          required: ["question_code", "got_right", "lost_marks"],
        },
      },
      skill_drills: {
        type: "array",
        items: { type: "string" },
      },
    },
    required: [
      "knowledge_summary",
      "application_summary",
      "primary_blocker",
      "core_verdict",
      "questions",
      "skill_drills",
    ],
  },
} as const;

export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function pct(earned: number, available: number): number {
  if (!available || available <= 0) return 0;
  return Math.max(0, Math.min(100, round1((earned / available) * 100)));
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : NaN;
}

export function asStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/\n+/)
      .map((line) => line.replace(/^\s*(?:\d+[.)]|[-*])\s*/, "").trim())
      .filter(Boolean);
  }
  return [];
}

export function inferPrimaryBlocker(knowledgePct: number, applicationPct: number): PrimaryBlocker {
  const gap = knowledgePct - applicationPct;
  if (knowledgePct < 55 && applicationPct < 55) return "both";
  if (gap >= 8) return "execution";
  if (gap <= -8) return "theory";
  if (applicationPct < knowledgePct) return "execution";
  if (knowledgePct < applicationPct) return "theory";
  return "both";
}

export function splitQuestionBlock(raw: Record<string, unknown>): DiagnosticQuestionInput | null {
  const question_code = String(raw.question_code || raw.question || raw.block || "").trim();
  if (!question_code) return null;

  let tier1_earned = asNumber(raw.tier1_earned);
  let tier1_available = asNumber(raw.tier1_available);
  let tier2_earned = asNumber(raw.tier2_earned);
  let tier2_available = asNumber(raw.tier2_available);
  const available = asNumber(raw.available_marks);
  const earned = asNumber(raw.earned_marks);

  if ((!tier1_available && !tier2_available) && available > 0) {
    tier1_available = round1(available * KNOWLEDGE_WEIGHT);
    tier2_available = round1(available - tier1_available);
    if (earned >= 0) {
      tier1_earned = round1(Math.min(tier1_available, earned * KNOWLEDGE_WEIGHT));
      tier2_earned = round1(Math.max(0, Math.min(tier2_available, earned - tier1_earned)));
    } else {
      tier1_earned = 0;
      tier2_earned = 0;
    }
  }

  const marks = [tier1_earned, tier1_available, tier2_earned, tier2_available];
  if (marks.some((n) => Number.isNaN(n) || n < 0)) return null;
  if (tier1_earned > tier1_available || tier2_earned > tier2_available) return null;

  return {
    question_code,
    tier1_earned,
    tier1_available,
    tier2_earned,
    tier2_available,
  };
}

export function withQuestionStats(input: DiagnosticQuestionInput, extras?: { got_right?: string[]; lost_marks?: string[] }): DiagnosticQuestion {
  const available_marks = round1(input.tier1_available + input.tier2_available);
  const question_total = round1(input.tier1_earned + input.tier2_earned);
  return {
    ...input,
    available_marks,
    knowledge_earned_pct: pct(input.tier1_earned, input.tier1_available),
    application_earned_pct: pct(input.tier2_earned, input.tier2_available),
    question_total,
    question_total_pct: pct(question_total, available_marks),
    got_right: extras?.got_right || [],
    lost_marks: extras?.lost_marks || [],
  };
}

export function summariseBlocks(blocks: DiagnosticQuestionInput[]) {
  const tier1_earned = round1(blocks.reduce((sum, block) => sum + block.tier1_earned, 0));
  const tier1_available = round1(blocks.reduce((sum, block) => sum + block.tier1_available, 0));
  const tier2_earned = round1(blocks.reduce((sum, block) => sum + block.tier2_earned, 0));
  const tier2_available = round1(blocks.reduce((sum, block) => sum + block.tier2_available, 0));
  const total_earned = round1(tier1_earned + tier2_earned);
  const total_available = round1(tier1_available + tier2_available);
  const knowledge_pct = pct(tier1_earned, tier1_available);
  const application_pct = pct(tier2_earned, tier2_available);
  return {
    tier1_earned,
    tier1_available,
    tier2_earned,
    tier2_available,
    total_earned,
    total_available,
    total_score_pct: pct(total_earned, total_available),
    knowledge_pct,
    application_pct,
    primary_blocker: inferPrimaryBlocker(knowledge_pct, application_pct),
  };
}

export function parseQuestionBlocks(body: Record<string, unknown> | null): DiagnosticQuestionInput[] {
  if (!body) return [];
  const rawBlocks = Array.isArray(body.questions) && body.questions.length ? body.questions : [body];
  return rawBlocks
    .map((item) => (item && typeof item === "object" ? splitQuestionBlock(item as Record<string, unknown>) : null))
    .filter((block): block is DiagnosticQuestionInput => Boolean(block));
}

export function mergeModelReport(
  paper_name: string,
  student_notes: string,
  blocks: DiagnosticQuestionInput[],
  parsed: Record<string, unknown>
): DiagnosticReport {
  const totals = summariseBlocks(blocks);
  const modelQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const byCode = new Map<string, { got_right: string[]; lost_marks: string[] }>();
  for (const item of modelQuestions) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const code = String(row.question_code || "").trim();
    if (!code) continue;
    byCode.set(code, {
      got_right: asStringList(row.got_right || row.gotRight),
      lost_marks: asStringList(row.lost_marks || row.lostMarks),
    });
  }

  const questions = blocks.map((block) => {
    const extras = byCode.get(block.question_code);
    return withQuestionStats(block, extras);
  });

  const skill_drills = asStringList(parsed.skill_drills || parsed.coaching_recommendation).slice(0, 3);
  while (skill_drills.length < 3) {
    skill_drills.push("Practise writing the required in a planned structure before adding technical detail.");
  }

  return {
    paper_name,
    question_code: blocks.map((block) => block.question_code).join(", "),
    student_notes,
    ...totals,
    knowledge_summary:
      String(parsed.knowledge_summary || "").trim() || "Knowledge marks were recorded, but the model returned no summary.",
    application_summary:
      String(parsed.application_summary || "").trim() || "Application marks were recorded, but the model returned no summary.",
    primary_blocker: totals.primary_blocker,
    core_verdict:
      String(parsed.core_verdict || "").trim() ||
      (totals.primary_blocker === "theory"
        ? "The primary blocker is theory: knowledge marks are leaking before application can convert."
        : totals.primary_blocker === "execution"
          ? "The primary blocker is execution: knowledge is present, but application marks are not converting."
          : "Both theory and execution are leaking marks. Close the knowledge gaps, then convert them with structured application."),
    questions,
    skill_drills,
  };
}

export function reportToStorage(report: DiagnosticReport) {
  return {
    paper_name: report.paper_name,
    question_code: report.question_code,
    tier1_earned: report.tier1_earned,
    tier1_available: report.tier1_available,
    tier2_earned: report.tier2_earned,
    tier2_available: report.tier2_available,
    student_notes: report.student_notes,
    knowledge_summary: report.knowledge_summary,
    application_summary: report.application_summary,
    dropped_marks_breakdown: {
      primary_blocker: report.primary_blocker,
      core_verdict: report.core_verdict,
      questions: report.questions,
    },
    coaching_recommendation: report.skill_drills,
  };
}

export function rowToDiagnostic(row: Record<string, unknown>): DiagnosticReportResult {
  const paper_name = String(row.paper_name || "");
  const student_notes = String(row.student_notes || "");
  const breakdown = row.dropped_marks_breakdown;
  let blocks: DiagnosticQuestionInput[] = [];
  let extras: Record<string, { got_right: string[]; lost_marks: string[] }> = {};
  let storedBlocker: unknown;
  let storedVerdict = "";

  if (breakdown && typeof breakdown === "object" && !Array.isArray(breakdown)) {
    const packed = breakdown as Record<string, unknown>;
    storedBlocker = packed.primary_blocker;
    storedVerdict = String(packed.core_verdict || "");
    const storedQuestions = Array.isArray(packed.questions) ? packed.questions : [];
    blocks = storedQuestions
      .map((item) => (item && typeof item === "object" ? splitQuestionBlock(item as Record<string, unknown>) : null))
      .filter((block): block is DiagnosticQuestionInput => Boolean(block));
    for (const item of storedQuestions) {
      if (!item || typeof item !== "object") continue;
      const q = item as Record<string, unknown>;
      const code = String(q.question_code || "").trim();
      if (!code) continue;
      extras[code] = {
        got_right: asStringList(q.got_right),
        lost_marks: asStringList(q.lost_marks || q.likely_loss),
      };
    }
  } else if (Array.isArray(breakdown) && breakdown.length) {
    blocks = breakdown
      .map((item) => (item && typeof item === "object" ? splitQuestionBlock(item as Record<string, unknown>) : null))
      .filter((block): block is DiagnosticQuestionInput => Boolean(block));
  }

  if (!blocks.length) {
    const fallback = splitQuestionBlock(row);
    if (fallback) blocks = [fallback];
  }

  const report = mergeModelReport(paper_name, student_notes, blocks, {
    knowledge_summary: row.knowledge_summary,
    application_summary: row.application_summary,
    primary_blocker: storedBlocker,
    core_verdict: storedVerdict,
    skill_drills: row.coaching_recommendation || row.skill_drills,
    questions: blocks.map((block) => ({
      question_code: block.question_code,
      got_right: extras[block.question_code]?.got_right || [],
      lost_marks: extras[block.question_code]?.lost_marks || [],
    })),
  });

  return {
    ...report,
    id: row.id ? String(row.id) : undefined,
    created_at: row.created_at ? String(row.created_at) : undefined,
  };
}

export function blockerLabel(blocker: PrimaryBlocker): string {
  if (blocker === "theory") return "Theory is the primary blocker";
  if (blocker === "execution") return "Execution is the primary blocker";
  return "Theory and execution are both blocking marks";
}
