import { getSupabase } from "./supabase";
import { findPastPaper } from "./past-papers";

export const EXAM_ATTEMPT_STATUSES = [
  "started",
  "awaiting_documents",
  "ready_to_submit",
  "analysing",
  "evidence_ready",
  "report_ready",
  "analysis_failed",
] as const;

export type ExamAttemptStatus = (typeof EXAM_ATTEMPT_STATUSES)[number];
export type ExamAttemptFileKind = "bmcr_worksheet" | "marked_script" | "marking_report";

export type ExamAttemptPageImage = {
  page: number;
  path: string;
  url: string;
};

export type ExamAttempt = {
  id: string;
  user_id: string;
  exam_body: string;
  sitting_id: string;
  paper_id: string;
  sitting_label: string;
  paper_title: string;
  paper_code: string;
  status: ExamAttemptStatus;
  bmcr_worksheet_path: string | null;
  bmcr_worksheet_url: string | null;
  bmcr_worksheet_name: string | null;
  marked_script_path: string | null;
  marked_script_url: string | null;
  marked_script_name: string | null;
  marking_report_path: string | null;
  marking_report_url: string | null;
  marking_report_name: string | null;
  page_images: Partial<Record<ExamAttemptFileKind, ExamAttemptPageImage[]>>;
  evidence_pack: Record<string, unknown> | null;
  evaluation_id: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
};

export const EXAM_ATTEMPT_FILE_LABELS: Record<ExamAttemptFileKind, string> = {
  bmcr_worksheet: "Completed BMCR worksheet",
  marked_script: "Marked exam script",
  marking_report: "Marking report",
};

export const EXAM_ATTEMPT_SQL_HINT =
  "Paste supabase/exam-attempts.sql in the Supabase SQL editor, then try again.";

const TERMINAL_STATUSES: ExamAttemptStatus[] = [
  "analysing",
  "evidence_ready",
  "report_ready",
  "analysis_failed",
];

export function isMissingExamAttemptsTable(message: string): boolean {
  return /exam_attempts|schema cache|PGRST205|could not find the table/i.test(message);
}

export function examAttemptTableError(message: string): string {
  if (isMissingExamAttemptsTable(message)) return EXAM_ATTEMPT_SQL_HINT;
  if (/row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return EXAM_ATTEMPT_SQL_HINT;
  }
  return message || "Could not save that exam attempt.";
}

export function attemptHasFile(attempt: ExamAttempt, kind: ExamAttemptFileKind): boolean {
  return Boolean(attempt[`${kind}_url`] || attempt[`${kind}_path`]);
}

export function attemptFileCount(attempt: ExamAttempt): number {
  return (["bmcr_worksheet", "marked_script", "marking_report"] as ExamAttemptFileKind[]).filter((kind) =>
    attemptHasFile(attempt, kind)
  ).length;
}

export function deriveAttemptStatus(attempt: Pick<ExamAttempt, "status"> & Partial<ExamAttempt>): ExamAttemptStatus {
  if (TERMINAL_STATUSES.includes(attempt.status)) return attempt.status;
  const count = attemptFileCount(attempt as ExamAttempt);
  if (count >= 3) return "ready_to_submit";
  if (count > 0) return "awaiting_documents";
  return "started";
}

export function attemptStatusLabel(status: ExamAttemptStatus): string {
  if (status === "started") return "Started";
  if (status === "awaiting_documents") return "Awaiting documents";
  if (status === "ready_to_submit") return "Ready to submit";
  if (status === "analysing") return "Analysing";
  if (status === "evidence_ready") return "Documents uploaded";
  if (status === "report_ready") return "Report ready";
  return "Analysis failed";
}

export function attemptDisplayTitle(attempt: Pick<ExamAttempt, "sitting_label" | "paper_title">): string {
  return `${attempt.sitting_label} · ${attempt.paper_title}`;
}

export function isAttemptSubmitted(status: ExamAttemptStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function asStatus(value: unknown): ExamAttemptStatus {
  const raw = String(value || "");
  return (EXAM_ATTEMPT_STATUSES as readonly string[]).includes(raw) ? (raw as ExamAttemptStatus) : "started";
}

function asPageImages(value: unknown): ExamAttempt["page_images"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const row = value as JsonRow;
  const next: ExamAttempt["page_images"] = {};
  for (const kind of ["bmcr_worksheet", "marked_script", "marking_report"] as ExamAttemptFileKind[]) {
    const list = row[kind];
    if (!Array.isArray(list)) continue;
    next[kind] = list
      .map((item) => {
        const image = item as JsonRow;
        const page = Number(image.page);
        const path = String(image.path || "");
        const url = String(image.url || "");
        if (!Number.isFinite(page) || !url) return null;
        return { page, path, url };
      })
      .filter((item): item is ExamAttemptPageImage => Boolean(item));
  }
  return next;
}

type JsonRow = Record<string, unknown>;

export function examAttemptFromRow(row: JsonRow): ExamAttempt {
  return {
    id: String(row.id || ""),
    user_id: String(row.user_id || ""),
    exam_body: String(row.exam_body || "IAC"),
    sitting_id: String(row.sitting_id || ""),
    paper_id: String(row.paper_id || ""),
    sitting_label: String(row.sitting_label || ""),
    paper_title: String(row.paper_title || ""),
    paper_code: String(row.paper_code || ""),
    status: asStatus(row.status),
    bmcr_worksheet_path: row.bmcr_worksheet_path ? String(row.bmcr_worksheet_path) : null,
    bmcr_worksheet_url: row.bmcr_worksheet_url ? String(row.bmcr_worksheet_url) : null,
    bmcr_worksheet_name: row.bmcr_worksheet_name ? String(row.bmcr_worksheet_name) : null,
    marked_script_path: row.marked_script_path ? String(row.marked_script_path) : null,
    marked_script_url: row.marked_script_url ? String(row.marked_script_url) : null,
    marked_script_name: row.marked_script_name ? String(row.marked_script_name) : null,
    marking_report_path: row.marking_report_path ? String(row.marking_report_path) : null,
    marking_report_url: row.marking_report_url ? String(row.marking_report_url) : null,
    marking_report_name: row.marking_report_name ? String(row.marking_report_name) : null,
    page_images: asPageImages(row.page_images),
    evidence_pack: row.evidence_pack && typeof row.evidence_pack === "object" ? (row.evidence_pack as JsonRow) : null,
    evaluation_id: row.evaluation_id ? String(row.evaluation_id) : null,
    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || ""),
    submitted_at: row.submitted_at ? String(row.submitted_at) : null,
  };
}

export type ExamAttemptsResult =
  | { ok: true; attempts: ExamAttempt[] }
  | { ok: false; error: string; missingTable?: boolean };

export async function fetchOwnExamAttempts(userId: string): Promise<ExamAttemptsResult> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await client
    .from("exam_attempts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    return {
      ok: false,
      error: examAttemptTableError(error.message),
      missingTable: isMissingExamAttemptsTable(error.message),
    };
  }
  return { ok: true, attempts: (data || []).map((row) => examAttemptFromRow(row as JsonRow)) };
}

export type ExamAttemptFetch =
  | { ok: true; attempts: ExamAttempt[]; attempt: ExamAttempt }
  | { ok: false; error: string; missingTable?: boolean };

export async function fetchExamAttempt(userId: string, attemptId: string): Promise<ExamAttemptFetch> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await client
    .from("exam_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", attemptId)
    .limit(1)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      error: examAttemptTableError(error.message),
      missingTable: isMissingExamAttemptsTable(error.message),
    };
  }
  if (!data) return { ok: false, error: "That exam attempt was not found." };
  const mapped = examAttemptFromRow(data as JsonRow);
  return { ok: true, attempts: [mapped], attempt: mapped };
}

export async function createExamAttempt(input: {
  userId: string;
  sittingId: string;
  paperId: string;
}): Promise<{ ok: true; attempt: ExamAttempt } | { ok: false; error: string; missingTable?: boolean }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const mapped = findPastPaper(input.paperId);
  if (!mapped || mapped.sitting.id !== input.sittingId) {
    return { ok: false, error: "Choose a sitting and a paper from the exam list." };
  }
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("exam_attempts")
    .insert({
      user_id: input.userId,
      exam_body: "IAC",
      sitting_id: mapped.sitting.id,
      paper_id: mapped.paper.id,
      sitting_label: mapped.sitting.label.replace(/ IAC Exam$/i, ""),
      paper_title: mapped.paper.title,
      paper_code: mapped.paper.code,
      status: "started",
      updated_at: now,
    })
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return {
      ok: false,
      error: examAttemptTableError(error?.message || "Could not start that exam attempt."),
      missingTable: isMissingExamAttemptsTable(error?.message || ""),
    };
  }
  return { ok: true, attempt: examAttemptFromRow(data as JsonRow) };
}

function isPdfFile(file: File): boolean {
  const type = (file.type || "").toLowerCase();
  const name = file.name.toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

function storageUploadError(message: string): string {
  if (/row-level security|not allowed|policy|unauthorized|403/i.test(message)) return EXAM_ATTEMPT_SQL_HINT;
  return message || "Could not upload that file.";
}

export async function uploadExamAttemptFile(input: {
  userId: string;
  attemptId: string;
  kind: ExamAttemptFileKind;
  file: File;
  pageImages?: { page: number; blob: Blob }[];
}): Promise<{ ok: true; attempt: ExamAttempt } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  if (!input.file.size) return { ok: false, error: "That file looks empty. Choose the PDF again." };
  if (input.file.size > 50 * 1024 * 1024) return { ok: false, error: "That PDF is larger than 50 MB." };
  if (!isPdfFile(input.file)) return { ok: false, error: "Please upload a PDF file." };

  const ownerId = session.user.id || input.userId;
  const safeName = input.file.name.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || `${input.kind}.pdf`;
  const stamp = Date.now();
  const path = `exam-attempts/${ownerId}/${input.attemptId}/${input.kind}/${stamp}-${safeName}`;
  const uploaded = await client.storage.from("course-pdfs").upload(path, input.file, {
    upsert: false,
    contentType: "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: storageUploadError(uploaded.error.message) };
  const { data: publicFile } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!publicFile?.publicUrl) return { ok: false, error: "Could not get a URL for that file." };

  const existing = await fetchExamAttempt(ownerId, input.attemptId);
  if (existing.ok === false) return { ok: false, error: existing.error };
  if (!existing.attempt) return { ok: false, error: "That exam attempt was not found." };
  if (isAttemptSubmitted(existing.attempt.status)) {
    return { ok: false, error: "This attempt is already submitted. Start a new exam attempt for another script." };
  }

  const pageImages = { ...existing.attempt.page_images };
  if (input.pageImages?.length) {
    const stored: ExamAttemptPageImage[] = [];
    for (const page of input.pageImages) {
      const pagePath = `exam-attempts/${ownerId}/${input.attemptId}/${input.kind}/pages/${stamp}-p${String(page.page).padStart(3, "0")}.jpg`;
      const pageUpload = await client.storage.from("course-pdfs").upload(pagePath, page.blob, {
        upsert: false,
        contentType: "image/jpeg",
      });
      if (pageUpload.error) continue;
      const { data: pageUrl } = client.storage.from("course-pdfs").getPublicUrl(pagePath);
      if (pageUrl?.publicUrl) stored.push({ page: page.page, path: pagePath, url: pageUrl.publicUrl });
    }
    pageImages[input.kind] = stored;
  }

  const patch: Record<string, unknown> = {
    [`${input.kind}_path`]: path,
    [`${input.kind}_url`]: publicFile.publicUrl,
    [`${input.kind}_name`]: input.file.name,
    page_images: pageImages,
    updated_at: new Date().toISOString(),
  };
  const nextDraft = examAttemptFromRow({ ...existing.attempt, ...patch });
  patch.status = deriveAttemptStatus({ ...nextDraft, status: "started" });

  const { data, error } = await client
    .from("exam_attempts")
    .update(patch)
    .eq("id", input.attemptId)
    .eq("user_id", ownerId)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false, error: examAttemptTableError(error?.message || "Could not attach that file.") };
  return { ok: true, attempt: examAttemptFromRow(data as JsonRow) };
}

export async function markAttemptAnalysing(
  userId: string,
  attemptId: string
): Promise<{ ok: true; attempt: ExamAttempt } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const existing = await fetchExamAttempt(userId, attemptId);
  if (existing.ok === false) return { ok: false, error: existing.error };
  if (!existing.attempt) return { ok: false, error: "That exam attempt was not found." };
  if (isAttemptSubmitted(existing.attempt.status)) return { ok: true, attempt: existing.attempt };
  if (attemptFileCount(existing.attempt) < 3) {
    return { ok: false, error: "Upload the completed BMCR worksheet, marked script, and marking report first." };
  }
  const now = new Date().toISOString();
  const { data, error } = await client
    .from("exam_attempts")
    .update({ status: "analysing", submitted_at: now, updated_at: now })
    .eq("id", attemptId)
    .eq("user_id", userId)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false, error: examAttemptTableError(error?.message || "Could not submit that attempt.") };
  return { ok: true, attempt: examAttemptFromRow(data as JsonRow) };
}
