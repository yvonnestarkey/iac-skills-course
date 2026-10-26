import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  writeChapterOrder,
  writeLessonDelete,
  writeLessonPatch,
  writeLessonRows,
} from "@/lib/content";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

type LessonWriteBody =
  | { action: "upsert"; rows: Record<string, unknown>[] }
  | { action: "update"; id: string; patch: Record<string, unknown> }
  | { action: "delete"; id: string }
  | { action: "reorder"; chapterId: string; lessonIds: string[] };

function asWriteBody(value: unknown): LessonWriteBody | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (body.action === "upsert" && Array.isArray(body.rows)) {
    return { action: "upsert", rows: body.rows as Record<string, unknown>[] };
  }
  if (body.action === "update" && typeof body.id === "string" && body.patch && typeof body.patch === "object") {
    return { action: "update", id: body.id, patch: body.patch as Record<string, unknown> };
  }
  if (body.action === "delete" && typeof body.id === "string") {
    return { action: "delete", id: body.id };
  }
  if (body.action === "reorder" && typeof body.chapterId === "string" && Array.isArray(body.lessonIds)) {
    return { action: "reorder", chapterId: body.chapterId, lessonIds: body.lessonIds.map((id) => String(id)) };
  }
  return null;
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const client = getServiceSupabase();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const body = asWriteBody(await request.json().catch(() => null));
  if (!body) return NextResponse.json({ error: "Lesson save action required." }, { status: 400 });

  const result =
    body.action === "upsert"
      ? await writeLessonRows(client, body.rows)
      : body.action === "update"
        ? await writeLessonPatch(client, body.id, body.patch)
        : body.action === "delete"
          ? await writeLessonDelete(client, body.id)
          : await writeChapterOrder(client, body.chapterId, body.lessonIds);

  if (!result.ok) return NextResponse.json({ error: result.error || "Could not save lessons." }, { status: 400 });
  revalidateTag("course-outline");
  return NextResponse.json({ ok: true, data: result.data ?? null });
}
