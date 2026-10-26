import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { getEntitlementRecord, listPreviewLessonIds } from "@/lib/commerce";
import { provisionStudentCommerceAccount } from "@/lib/enrolment-notify";
import { canViewDraftLessons, publishedOutline } from "@/lib/lesson-drafts";
import { getStaffCourseView } from "@/lib/staff-access-server";
import { fetchCourseOutline } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  await provisionStudentCommerceAccount(user);
  const [outline, entitlement, previewIds, staffView] = await Promise.all([
    fetchCourseOutline(),
    getEntitlementRecord(user.id),
    listPreviewLessonIds(),
    getStaffCourseView(),
  ]);
  return NextResponse.json({
    outline: canViewDraftLessons(user, staffView) ? outline : publishedOutline(outline),
    entitlement: entitlement.accessActive ? entitlement.status : "none",
    entitlement_source: entitlement.source,
    preview_lesson_ids: previewIds,
  });
}
