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

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function rowToEvaluation(row: Record<string, unknown>): ScriptEvaluationRecord {
  return {
    id: String(row.id || ""),
    created_at: String(row.created_at || ""),
    paper_name: String(row.paper_name || ""),
    question_code: String(row.question_code || ""),
    tier1_earned: asNumber(row.tier1_earned),
    tier1_available: asNumber(row.tier1_available),
    tier2_earned: asNumber(row.tier2_earned),
    tier2_available: asNumber(row.tier2_available),
    student_notes: String(row.student_notes || ""),
    knowledge_summary: String(row.knowledge_summary || ""),
    application_summary: String(row.application_summary || ""),
    dropped_marks_breakdown: asDroppedMarks(row.dropped_marks_breakdown),
    coaching_recommendation: asStringList(row.coaching_recommendation),
  };
}

export async function fetchOwnEvaluations(userId: string): Promise<ScriptEvaluationRecord[]> {
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
  return (data || []).map((row) => rowToEvaluation(row as Record<string, unknown>));
}

export function pct(earned: number, available: number): number {
  if (!available || available <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((earned / available) * 1000) / 10));
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

export function asDroppedMarks(value: unknown): DroppedMark[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== "object") {
      return { area: "Application", likely_loss: String(item), examiner_note: "" };
    }
    const row = item as Record<string, unknown>;
    return {
      area: String(row.area || row.topic || "Application"),
      likely_loss: String(row.likely_loss || row.marks || row.loss || ""),
      examiner_note: String(row.examiner_note || row.note || row.reason || ""),
    };
  });
}
