import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 50 * 1024 * 1024;

function isPdfFile(file: File): boolean {
  return file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf");
}

function pdfPath(fileName: string): string {
  const ext = (fileName.split(".").pop() || "pdf").toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
  return `lesson-pdfs/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const db = getServiceSupabase();
  if (!db) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });
  }
  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json({ error: "That PDF is larger than 50 MB. Compress it, then try again." }, { status: 400 });
  }
  if (!isPdfFile(file)) {
    return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
  }
  const path = pdfPath(file.name);
  const uploaded = await db.storage.from("course-pdfs").upload(path, Buffer.from(await file.arrayBuffer()), {
    upsert: true,
    contentType: "application/pdf",
  });
  if (uploaded.error) {
    return NextResponse.json({ error: uploaded.error.message || "Could not upload that PDF." }, { status: 400 });
  }
  const { data } = db.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) {
    return NextResponse.json({ error: "Could not get a URL for that PDF." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, url: data.publicUrl });
}
