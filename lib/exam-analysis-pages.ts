import { getServiceSupabase } from "@/lib/supabase-admin";
import {
  examAttemptFromRow,
  type ExamAttempt,
  type ExamAttemptFileKind,
  type ExamAttemptPageImage,
} from "@/lib/exam-attempts";
import { countPdfPages, renderPdfPageJpegs } from "@/lib/pdf-page-images-server";

export const ANALYSIS_FILE_KINDS: ExamAttemptFileKind[] = [
  "bmcr_worksheet",
  "marked_script",
  "marking_report",
];

export type AnalysisFilePages = {
  kind: ExamAttemptFileKind;
  name: string | null;
  pdf_url: string | null;
  pdf_path: string | null;
  pdf_page_count: number | null;
  image_count: number;
  complete: boolean;
  missing_pages: number[];
  pages: ExamAttemptPageImage[];
};

export type AttemptAnalysisPages = {
  attempt_id: string;
  user_id: string;
  sitting_id: string;
  paper_id: string;
  status: string;
  analysed: false;
  files: Record<ExamAttemptFileKind, AnalysisFilePages>;
  multimodal_inputs: { kind: ExamAttemptFileKind; page: number; image_url: string }[];
};

export function missingPages(pdfPageCount: number, stored: { page: number }[]): number[] {
  const have = new Set(stored.map((item) => item.page));
  const missing: number[] = [];
  for (let page = 1; page <= pdfPageCount; page += 1) {
    if (!have.has(page)) missing.push(page);
  }
  return missing;
}

function filePages(
  attempt: ExamAttempt,
  kind: ExamAttemptFileKind,
  pdfPageCount: number | null
): AnalysisFilePages {
  const pages = [...(attempt.page_images[kind] || [])].sort((a, b) => a.page - b.page);
  const expected = pdfPageCount || pages.length;
  const missing = pdfPageCount ? missingPages(pdfPageCount, pages) : [];
  return {
    kind,
    name: attempt[`${kind}_name`],
    pdf_url: attempt[`${kind}_url`],
    pdf_path: attempt[`${kind}_path`],
    pdf_page_count: pdfPageCount,
    image_count: pages.length,
    complete: expected > 0 && missing.length === 0 && pages.length >= expected,
    missing_pages: missing,
    pages,
  };
}

async function fetchPdfBuffer(url: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    return await response.arrayBuffer();
  } catch {
    return null;
  }
}

export async function loadAttemptForAnalysis(attemptId: string): Promise<ExamAttempt | null> {
  const supabase = getServiceSupabase();
  if (!supabase) return null;
  const { data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).limit(1).maybeSingle();
  if (error || !data) return null;
  return examAttemptFromRow(data as { [key: string]: unknown });
}

export async function getAttemptAnalysisPages(attemptId: string): Promise<AttemptAnalysisPages | null> {
  const attempt = await loadAttemptForAnalysis(attemptId);
  if (!attempt) return null;
  const files = {} as Record<ExamAttemptFileKind, AnalysisFilePages>;
  const multimodal_inputs: AttemptAnalysisPages["multimodal_inputs"] = [];
  for (const kind of ANALYSIS_FILE_KINDS) {
    let pdfPageCount: number | null = null;
    const url = attempt[`${kind}_url`];
    if (url) {
      const buffer = await fetchPdfBuffer(url);
      if (buffer) pdfPageCount = await countPdfPages(buffer);
    }
    const file = filePages(attempt, kind, pdfPageCount);
    files[kind] = file;
    for (const page of file.pages) {
      multimodal_inputs.push({ kind, page: page.page, image_url: page.url });
    }
  }
  return {
    attempt_id: attempt.id,
    user_id: attempt.user_id,
    sitting_id: attempt.sitting_id,
    paper_id: attempt.paper_id,
    status: attempt.status,
    analysed: false,
    files,
    multimodal_inputs,
  };
}

/** Render any PDF pages that were cut off or never imaged. Does not call a model. */
export async function ensureCompleteAttemptPageImages(attemptId: string): Promise<
  { ok: true; attempt: ExamAttempt; rendered: Record<ExamAttemptFileKind, number> } | { ok: false; error: string }
> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set." };
  const attempt = await loadAttemptForAnalysis(attemptId);
  if (!attempt) return { ok: false, error: "That exam attempt was not found." };

  const pageImages = { ...attempt.page_images };
  const rendered: Record<ExamAttemptFileKind, number> = {
    bmcr_worksheet: 0,
    marked_script: 0,
    marking_report: 0,
  };
  const stamp = Date.now();

  for (const kind of ANALYSIS_FILE_KINDS) {
    const url = attempt[`${kind}_url`];
    if (!url) continue;
    try {
      const buffer = await fetchPdfBuffer(url);
      if (!buffer) continue;
      const existing = pageImages[kind] || [];
      const already = new Set(existing.map((item) => item.page));
      const extra = await renderPdfPageJpegs(buffer, already);
      const stored = [...existing];
      for (const page of extra.pages) {
        const pagePath = `exam-attempts/${attempt.user_id}/${attempt.id}/${kind}/pages/${stamp}-p${String(page.page).padStart(3, "0")}.jpg`;
        const uploaded = await supabase.storage.from("course-pdfs").upload(pagePath, page.bytes, {
          upsert: false,
          contentType: page.contentType,
        });
        if (uploaded.error) continue;
        const { data } = supabase.storage.from("course-pdfs").getPublicUrl(pagePath);
        if (!data?.publicUrl) continue;
        stored.push({ page: page.page, path: pagePath, url: data.publicUrl });
        rendered[kind] += 1;
      }
      stored.sort((a, b) => a.page - b.page);
      pageImages[kind] = stored;
    } catch {
      // Keep whatever images already exist for this file.
    }
  }

  const added = rendered.bmcr_worksheet + rendered.marked_script + rendered.marking_report;
  if (added === 0) return { ok: true, attempt, rendered };

  const { data, error } = await supabase
    .from("exam_attempts")
    .update({ page_images: pageImages, updated_at: new Date().toISOString() })
    .eq("id", attemptId)
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "Could not store completed page images." };
  return { ok: true, attempt: examAttemptFromRow(data as { [key: string]: unknown }), rendered };
}
