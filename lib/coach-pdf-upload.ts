import { getSupabase } from "./supabase";

export const COACH_PDF_FOLDERS = ["lesson-pdfs", "live-sessions"] as const;
export type CoachPdfFolder = (typeof COACH_PDF_FOLDERS)[number];

const MAX_PDF_BYTES = 50 * 1024 * 1024;

export function isCoachPdfFolder(value: string | null | undefined): value is CoachPdfFolder {
  return Boolean(value && (COACH_PDF_FOLDERS as readonly string[]).includes(value));
}

export function isCoachPdfFile(file: { type?: string; name?: string; size?: number }): boolean {
  const name = String(file.name || "").toLowerCase();
  const type = String(file.type || "").toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

export async function uploadCoachPdf(
  file: File,
  folder: CoachPdfFolder
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (typeof window === "undefined") return { ok: false, error: "PDF uploads need a signed-in coach browser." };
  if (!file.size) return { ok: false, error: "That file looks empty. Choose the PDF again." };
  if (file.size > MAX_PDF_BYTES) return { ok: false, error: "That PDF is larger than 50 MB. Compress it, then try again." };
  if (!isCoachPdfFile(file)) return { ok: false, error: "Please upload a PDF file." };

  const signedResponse = await fetch("/api/coach/pdf", {
    method: "POST",
    credentials: "same-origin",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ action: "sign-upload", folder, fileName: file.name }),
  });
  const signed = (await signedResponse.json().catch(() => ({}))) as {
    error?: string;
    path?: string;
    token?: string;
    url?: string;
  };
  if (!signedResponse.ok || !signed.path || !signed.token) {
    return { ok: false, error: signed.error || "Could not start that PDF upload." };
  }

  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const uploaded = await client.storage.from("course-pdfs").uploadToSignedUrl(signed.path, signed.token, file, {
    contentType: "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: uploaded.error.message || "Could not upload that PDF." };

  if (signed.url) return { ok: true, url: signed.url };
  const { data } = client.storage.from("course-pdfs").getPublicUrl(signed.path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a URL for that PDF." };
  return { ok: true, url: data.publicUrl };
}
