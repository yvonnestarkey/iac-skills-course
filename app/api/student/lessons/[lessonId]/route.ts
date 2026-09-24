import { NextResponse } from "next/server";
import { getLessonAccess } from "@/lib/lesson-access";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { getCourseProduct, resolveLessonContentAccess, stripProtectedLesson } from "@/lib/commerce";
import { composeLessonAvailability } from "@/lib/lesson-availability";
import { protectLessonResourceFields } from "@/lib/lesson-assets";
import { getServiceSupabase } from "@/lib/supabase-admin";

const LESSON_COLUMNS =
  "id, title, type, duration, seconds, chapter_id, position, video_urls, blurb, body, takeaways, due, brief, requires_submission, requires_coach_approval, prereq_lesson_id, pdf_url, resource_downloads, unlock_at, video_duration_seconds, estimated_read_minutes, duration_minutes, survey_id, banner_image_url";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ lessonId: string }> }) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { lessonId } = await context.params;
  const client = getServiceSupabase();
  if (!client) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const { data, error } = await client.from("lessons").select(LESSON_COLUMNS).eq("id", lessonId).maybeSingle();
  if (error) return NextResponse.json({ error: "Could not load lesson." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Lesson not found." }, { status: 404 });

  const commercial = await resolveLessonContentAccess(user, lessonId);
  const pedagogical = isStaffUser(user) ? { isLocked: false } : await getLessonAccess(user.id, lessonId);
  const composed = composeLessonAvailability({
    commercialCanRead: commercial.canReadBody,
    isPreviewLesson: commercial.preview,
    pedagogical,
  });
  const product = await getCourseProduct();
  const lesson = await protectLessonResourceFields(data as Record<string, unknown>, {
    canRead: composed.canReadBody,
    preview: commercial.preview,
  });
  if (!composed.canReadBody) {
    return NextResponse.json({
      lesson: stripProtectedLesson(lesson),
      access: { ...commercial, ...composed.access, layer: composed.layer },
      locked: true,
      message: composed.layer === "purchase" ? product.locked_lesson_message : composed.access.reason,
      cta: composed.layer === "purchase" ? product.buy_cta_label : undefined,
    });
  }
  return NextResponse.json({ lesson, access: { ...commercial, ...composed.access, layer: composed.layer }, locked: false });
}
