import { isUserId } from "./notifications";
import { getSupabase } from "./supabase";

export const STUDENT_PDFS_SQL_HINT = "Paste supabase/student-pdfs.sql in the Supabase SQL editor, then try again.";

export type StudentPdf = {
  id: string;
  studentId: string;
  title: string;
  fileName: string;
  fileUrl: string;
  storagePath: string;
  uploadedBy: string | null;
  createdAt: string;
};

function tableMissing(message: string): boolean {
  return /student_pdfs|does not exist|schema cache|could not find/i.test(message);
}

function studentPdfError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return STUDENT_PDFS_SQL_HINT;
  }
  return message || "Could not update that PDF repository.";
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeStudentPdfName(name: string): string {
  const cleaned = String(name || "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "file"}.pdf`;
}

export function studentPdfStoragePath(studentId: string, fileName: string, now = Date.now()): string {
  return `student-files/${studentId}/${now}-${sanitizeStudentPdfName(fileName)}`;
}

function fromRow(row: Record<string, unknown>): StudentPdf {
  return {
    id: String(row.id),
    studentId: String(row.student_id || ""),
    title: asText(row.title),
    fileName: asText(row.file_name) || "file.pdf",
    fileUrl: asText(row.file_url),
    storagePath: asText(row.storage_path),
    uploadedBy: asText(row.uploaded_by) || null,
    createdAt: asText(row.created_at),
  };
}

function isPdfFile(file: File): boolean {
  return file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
}

export async function listStudentPdfs(studentId: string): Promise<{ ok: boolean; error?: string; files: StudentPdf[] }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured.", files: [] };
  if (!isUserId(studentId)) return { ok: false, error: "Missing student.", files: [] };
  const { data, error } = await client
    .from("student_pdfs")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: studentPdfError(error.message), files: [] };
  return { ok: true, files: ((data || []) as Record<string, unknown>[]).map(fromRow) };
}

export async function uploadStudentPdf(
  studentId: string,
  file: File,
  title = ""
): Promise<{ ok: true; file: StudentPdf } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data: session } = await client.auth.getUser();
  if (!session.user) return { ok: false, error: "Sign in required." };
  if (!isUserId(studentId)) return { ok: false, error: "Missing student." };
  if (!file.size) return { ok: false, error: "That file looks empty. Choose the PDF again." };
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: "That PDF is larger than 50 MB. Compress it, then try again." };
  if (!isPdfFile(file)) return { ok: false, error: "Please upload a PDF file." };

  const path = studentPdfStoragePath(studentId, file.name);
  const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
    upsert: false,
    contentType: "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: studentPdfError(uploaded.error.message) };
  const { data: publicFile } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!publicFile?.publicUrl) return { ok: false, error: "Could not get a URL for that file." };

  const { data, error } = await client
    .from("student_pdfs")
    .insert({
      student_id: studentId,
      title: title.trim(),
      file_name: file.name.trim() || "file.pdf",
      file_url: publicFile.publicUrl,
      storage_path: path,
      uploaded_by: session.user.email || session.user.id,
    })
    .select("*")
    .maybeSingle();
  if (error || !data) {
    await client.storage.from("course-pdfs").remove([path]);
    return { ok: false, error: studentPdfError(error?.message || "Could not save that PDF.") };
  }
  return { ok: true, file: fromRow(data as Record<string, unknown>) };
}

export async function deleteStudentPdf(file: Pick<StudentPdf, "id" | "storagePath">): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("student_pdfs").delete().eq("id", file.id);
  if (error) return { ok: false, error: studentPdfError(error.message) };
  if (file.storagePath) {
    await client.storage.from("course-pdfs").remove([file.storagePath]);
  }
  return { ok: true };
}
