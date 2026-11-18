import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { COACH_PDF_FOLDERS, isCoachPdfFile, isCoachPdfFolder, type CoachPdfFolder } from "@/lib/coach-pdf-upload";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function pdfPath(fileName: string, folder: CoachPdfFolder): string {
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  return `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

function publicPdfResponse(db: NonNullable<ReturnType<typeof getServiceSupabase>>, path: string, extra: Record<string, string> = {}) {
  const { data } = db.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) {
    return NextResponse.json({ error: "Could not get a URL for that PDF." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: data.publicUrl, path, ...extra });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => ({}))) as { action?: string; folder?: string; fileName?: string };
    if (body.action !== "sign-upload") {
      return NextResponse.json({ error: "Unknown PDF action." }, { status: 400 });
    }
    const folder = isCoachPdfFolder(body.folder) ? body.folder : body.folder ? null : "lesson-pdfs";
    if (!folder) {
      return NextResponse.json({ error: `Choose a PDF folder (${COACH_PDF_FOLDERS.join(", ")}).` }, { status: 400 });
    }
    const fileName = String(body.fileName || "file.pdf");
    if (!isCoachPdfFile({ type: "application/pdf", name: fileName, size: 1 })) {
      return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
    }
    const path = pdfPath(fileName, folder);
    const signed = await db.storage.from("course-pdfs").createSignedUploadUrl(path);
    if (signed.error || !signed.data?.token) {
      return NextResponse.json({ error: signed.error?.message || "Could not start that PDF upload." }, { status: 400 });
    }
    return publicPdfResponse(db, signed.data.path || path, {
      token: signed.data.token,
      signedUrl: signed.data.signedUrl || "",
    });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "That PDF is larger than 50 MB. Compress it, then try again." }, { status: 400 });
  }
  if (!isCoachPdfFile(file)) {
    return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
  }
  const path = pdfPath(file.name, "lesson-pdfs");
  const uploaded = await db.storage.from("course-pdfs").upload(path, Buffer.from(await file.arrayBuffer()), {
    upsert: true,
    contentType: "application/pdf",
  });
  if (uploaded.error) {
    return NextResponse.json({ error: uploaded.error.message || "Could not upload that PDF." }, { status: 400 });
  }
  return publicPdfResponse(db, path);
}
