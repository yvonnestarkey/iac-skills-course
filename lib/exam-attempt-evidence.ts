import { getServiceSupabase } from "@/lib/supabase-admin";
import { ensureCompleteAttemptPageImages } from "@/lib/exam-analysis-pages";
import {
  attemptFileCount,
  examAttemptFromRow,
  type ExamAttempt,
  type ExamAttemptFileKind,
} from "@/lib/exam-attempts";
import { loadOfficialSourcePack, summariseOfficialSourcePack } from "@/lib/exam-source-pack";

export type FileReadiness = {
  kind: ExamAttemptFileKind;
  name: string | null;
  url: string | null;
  path: string | null;
  page_count: number;
  text_chars: number;
  pages_with_text: number;
  page_image_count: number;
  text_preview: string;
  page_texts: { page: number; chars: number; preview: string }[];
  page_images: { page: number; url: string }[];
  read_method: "page_images_and_text" | "text_only" | "pdf_stored_unread";
  handwritten_likely: boolean;
};

export type EvidenceReadiness = {
  version: 1;
  kind: "internal_evidence_readiness";
  label: "INTERNAL/DEBUG — not a student diagnostic";
  prepared_at: string;
  sitting_id: string;
  paper_id: string;
  files: Record<ExamAttemptFileKind, FileReadiness>;
  official_sources: Record<string, unknown>;
  readable: boolean;
  notes: string[];
};

const FILE_KINDS: ExamAttemptFileKind[] = ["bmcr_worksheet", "marked_script", "marking_report"];

async function extractPdfPages(buffer: ArrayBuffer): Promise<{ page: number; text: string }[]> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const extracted = await extractText(pdf, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [String(extracted.text || "")];
  return pages.map((text, index) => ({ page: index + 1, text: String(text || "").trim() }));
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

function emptyReadiness(kind: ExamAttemptFileKind, attempt: ExamAttempt): FileReadiness {
  const images = attempt.page_images[kind] || [];
  return {
    kind,
    name: attempt[`${kind}_name`],
    url: attempt[`${kind}_url`],
    path: attempt[`${kind}_path`],
    page_count: images.length,
    text_chars: 0,
    pages_with_text: 0,
    page_image_count: images.length,
    text_preview: "",
    page_texts: [],
    page_images: images.map((image) => ({ page: image.page, url: image.url })),
    read_method: images.length ? "page_images_and_text" : "pdf_stored_unread",
    handwritten_likely: false,
  };
}

async function readAttemptFile(attempt: ExamAttempt, kind: ExamAttemptFileKind): Promise<FileReadiness> {
  const readiness = emptyReadiness(kind, attempt);
  const url = attempt[`${kind}_url`];
  if (!url) return readiness;

  const buffer = await fetchPdfBuffer(url);
  if (!buffer) {
    readiness.read_method = readiness.page_image_count ? "page_images_and_text" : "pdf_stored_unread";
    return readiness;
  }

  try {
    const pages = await extractPdfPages(buffer);
    readiness.page_count = Math.max(readiness.page_count, pages.length);
    readiness.page_texts = pages.map((page) => ({
      page: page.page,
      chars: page.text.length,
      preview: page.text.slice(0, 400),
    }));
    readiness.text_chars = pages.reduce((sum, page) => sum + page.text.length, 0);
    readiness.pages_with_text = pages.filter((page) => page.text.length > 0).length;
    readiness.text_preview = pages.map((page) => page.text).join("\n\n").slice(0, 800);
    readiness.handwritten_likely = readiness.page_count > 0 && readiness.text_chars / readiness.page_count < 80;
    if (readiness.page_image_count) readiness.read_method = "page_images_and_text";
    else if (readiness.text_chars > 0) readiness.read_method = "text_only";
    else readiness.read_method = "pdf_stored_unread";
  } catch {
    readiness.read_method = readiness.page_image_count ? "page_images_and_text" : "pdf_stored_unread";
  }
  return readiness;
}

export async function prepareExamAttemptEvidence(attemptId: string): Promise<
  { ok: true; attempt: ExamAttempt; pack: EvidenceReadiness } | { ok: false; error: string }
> {
  const supabase = getServiceSupabase();
  if (!supabase) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set." };

  const { data, error } = await supabase.from("exam_attempts").select("*").eq("id", attemptId).limit(1).maybeSingle();
  if (error || !data) return { ok: false, error: error?.message || "That exam attempt was not found." };
  let attempt = examAttemptFromRow(data as { [key: string]: unknown });
  if (attemptFileCount(attempt) < 3) {
    return { ok: false, error: "This attempt is missing one of the three required PDFs." };
  }
  try {
    const completed = await ensureCompleteAttemptPageImages(attemptId);
    if (completed.ok) attempt = completed.attempt;
  } catch {
    // Keep the images already stored if server-side render is unavailable.
  }

  const files = {
    bmcr_worksheet: await readAttemptFile(attempt, "bmcr_worksheet"),
    marked_script: await readAttemptFile(attempt, "marked_script"),
    marking_report: await readAttemptFile(attempt, "marking_report"),
  };
  const official = await loadOfficialSourcePack(attempt.sitting_id, attempt.paper_id);

  const notes = [
    "This is an internal evidence-readiness result, not a student diagnostic report.",
    "Extracted PDF text is stored for typed pages. Handwritten scripts need the stored page images — OCR text is not treated as script understanding.",
    ...official.notes,
  ];

  const filesReadable = FILE_KINDS.every((kind) => {
    const file = files[kind];
    return Boolean(file.url) && (file.page_image_count > 0 || file.text_chars > 0 || file.page_count > 0);
  });

  const pack: EvidenceReadiness = {
    version: 1,
    kind: "internal_evidence_readiness",
    label: "INTERNAL/DEBUG — not a student diagnostic",
    prepared_at: new Date().toISOString(),
    sitting_id: attempt.sitting_id,
    paper_id: attempt.paper_id,
    files,
    official_sources: summariseOfficialSourcePack(official),
    readable: filesReadable && official.complete,
    notes,
  };

  if (files.marked_script.handwritten_likely && files.marked_script.page_image_count === 0) {
    pack.notes.push("Marked script looks handwritten and no page images were stored. The original PDF is kept; render page images before treating it as model-readable.");
    pack.readable = false;
  }

  const failed =
    !filesReadable ||
    official.missing.includes("question") ||
    official.missing.includes("solution");

  const { data: saved, error: saveError } = await supabase
    .from("exam_attempts")
    .update({
      evidence_pack: pack,
      status: failed ? "analysis_failed" : "evidence_ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", attemptId)
    .select("*")
    .limit(1)
    .maybeSingle();

  if (saveError || !saved) return { ok: false, error: saveError?.message || "Could not store the evidence pack." };
  return { ok: true, attempt: examAttemptFromRow(saved as { [key: string]: unknown }), pack };
}
