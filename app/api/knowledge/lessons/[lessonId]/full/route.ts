import { NextResponse } from "next/server";
import { getCourseLessonFull } from "@/lib/knowledge-gateway";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await context.params;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(lessonId)) {
    return NextResponse.json({ error: "Invalid lesson id." }, { status: 400 });
  }
  try {
    const lesson = await getCourseLessonFull(lessonId);
    if (!lesson) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });
    return NextResponse.json(lesson);
  } catch (error) {
    console.error("getCourseLessonFull", error);
    return NextResponse.json({ error: "Could not load the lesson." }, { status: 500 });
  }
}
