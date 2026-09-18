import { asStringList, rowToDiagnostic, type DiagnosticReportResult } from "./diagnostic-report";

export { asStringList, pct, rowToDiagnostic } from "./diagnostic-report";
export type { DiagnosticReportResult } from "./diagnostic-report";

export type DroppedMark = {
  area: string;
  likely_loss: string;
  examiner_note: string;
};

export type ScriptEvaluationReport = {
  knowledge_summary: string;
  application_summary: string;
  dropped_marks_breakdown: DroppedMark[];
  coaching_recommendation: string[];
};

export type ScriptEvaluationInput = {
  paper_name: string;
  question_code: string;
  tier1_earned: number;
  tier1_available: number;
  tier2_earned: number;
  tier2_available: number;
  student_notes: string;
};

export type ScriptEvaluationRecord = ScriptEvaluationInput &
  ScriptEvaluationReport & {
    id: string;
    created_at: string;
  };

export type ScriptEvaluationResult = ScriptEvaluationRecord & {
  sources?: { title: string; category: string; similarity: number }[];
};

export function rowToEvaluation(row: Record<string, unknown>): ScriptEvaluationRecord {
  const report = rowToDiagnostic(row);
  return {
    id: report.id || "",
    created_at: report.created_at || "",
    paper_name: report.paper_name,
    question_code: report.question_code,
    tier1_earned: report.tier1_earned,
    tier1_available: report.tier1_available,
    tier2_earned: report.tier2_earned,
    tier2_available: report.tier2_available,
    student_notes: report.student_notes,
    knowledge_summary: report.knowledge_summary,
    application_summary: report.application_summary,
    dropped_marks_breakdown: report.questions.map((question) => ({
      area: question.question_code,
      likely_loss: question.lost_marks.join("; "),
      examiner_note: question.got_right.join("; "),
    })),
    coaching_recommendation: report.skill_drills,
  };
}

export async function fetchOwnEvaluations(userId: string): Promise<DiagnosticReportResult[]> {
  const { getSupabase } = await import("./supabase");
  const supabase = getSupabase();
  if (!supabase || !userId) return [];
  const { data, error } = await supabase
    .from("script_evaluations")
    .select(
      "id, created_at, paper_name, question_code, tier1_earned, tier1_available, tier2_earned, tier2_available, student_notes, knowledge_summary, application_summary, dropped_marks_breakdown, coaching_recommendation"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) return [];
  return (data || []).map((row) => rowToDiagnostic(row as Record<string, unknown>));
}

export function asDroppedMarks(value: unknown): DroppedMark[] {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const packed = value as Record<string, unknown>;
    if (Array.isArray(packed.questions)) return asDroppedMarks(packed.questions);
  }
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return { area: "Application", likely_loss: String(item), examiner_note: "" };
    }
    const row = item as Record<string, unknown>;
    return {
      area: String(row.area || row.topic || row.question_code || "Application"),
      likely_loss: String(row.likely_loss || row.marks || row.loss || asStringList(row.lost_marks).join("; ")),
      examiner_note: String(row.examiner_note || row.note || row.reason || asStringList(row.got_right).join("; ")),
    };
  });
}
