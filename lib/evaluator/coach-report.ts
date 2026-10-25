export const COACH_REPORT_SQL =
  "Paste supabase/exam-attempt-coach-report.sql in the Supabase SQL editor, then try again.";

export type ReleasedReportKind = "pdf" | "system";

export type ReleasedReport = {
  url: string;
  kind: ReleasedReportKind;
  name: string | null;
};

export function coachReportUrl(value: unknown): string | null {
  const url = String(value || "").trim();
  return url || null;
}

export function canReleaseEvaluatorReport(input: {
  systemReady: boolean;
  coachReportUrl?: string | null;
}): boolean {
  return input.systemReady || Boolean(coachReportUrl(input.coachReportUrl));
}

/** The report the student should open. A coach PDF always wins over the system HTML report. */
export function releasedReportForAttempt(input: {
  attemptId: string;
  coachReportUrl?: string | null;
  coachReportName?: string | null;
  released: boolean;
  staff: boolean;
  systemReady: boolean;
}): ReleasedReport | null {
  if (!input.released && !input.staff) return null;
  const pdf = coachReportUrl(input.coachReportUrl);
  if (pdf) {
    return {
      url: pdf,
      kind: "pdf",
      name: String(input.coachReportName || "").trim() || "Script evaluation.pdf",
    };
  }
  if (input.systemReady || input.staff) {
    return { url: `/evaluator-report/${input.attemptId}`, kind: "system", name: null };
  }
  return null;
}

export function isCoachReportPdf(file: { type?: string; name?: string; size?: number }): boolean {
  if (!file.size) return false;
  const type = String(file.type || "").toLowerCase();
  const name = String(file.name || "").toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

export function coachReportStoragePath(input: { userId: string; attemptId: string; fileName: string }): string {
  const safeName = input.fileName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "script-evaluation.pdf";
  return `exam-attempts/${input.userId}/${input.attemptId}/coach-report/${Date.now()}-${safeName}`;
}

export function isMissingCoachReportColumn(message: string): boolean {
  return /coach_report_|schema cache/i.test(message);
}
