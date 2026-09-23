import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { getEntitlement, listPreviewLessonIds } from "@/lib/commerce";
import { fetchCourseOutline } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const [outline, entitlement, previewIds] = await Promise.all([
    fetchCourseOutline(),
    getEntitlement(user.id),
    listPreviewLessonIds(),
  ]);
  return NextResponse.json({
    outline,
    entitlement,
    preview_lesson_ids: previewIds,
  });
}
