import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const LESSON_COLUMNS = "id, chapter_id, position, type, title, blurb, body, takeaways";

function sanitiseLessonId(value: string): string | null {
  const lessonId = value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(lessonId)) return null;
  return lessonId;
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item : ""))
      .filter(Boolean)
      .join("\n\n");
  }
  return "";
}

function asTakeaways(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  const text = typeof value === "string" ? value.trim() : "";
  return text ? [text] : [];
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ lessonId: string }> }
) {
  const { lessonId: rawId } = await context.params;
  const lessonId = sanitiseLessonId(String(rawId || ""));
  if (!lessonId) {
    return NextResponse.json({ error: "Invalid lesson id." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("lessons")
    .select(LESSON_COLUMNS)
    .eq("id", lessonId)
    .maybeSingle();

  if (error) {
    console.error("Course lesson fetch error:", error);
    return NextResponse.json({ error: "Could not load lesson." }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
  }

  const row = data as Record<string, unknown>;
  return NextResponse.json({
    id: String(row.id),
    chapter_id: String(row.chapter_id || ""),
    position: Number(row.position || 0),
    type: String(row.type || ""),
    title: String(row.title || ""),
    blurb: asText(row.blurb) || null,
    body: asText(row.body),
    takeaways: asTakeaways(row.takeaways),
  });
}
