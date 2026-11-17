import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { getClassroomSubjectUser } from "@/lib/view-as-student-server";
import { getEntitlementRecord, listPreviewLessonIds } from "@/lib/commerce";
import { provisionStudentCommerceAccount } from "@/lib/enrolment-notify";
import { canViewDraftLessons, publishedOutline } from "@/lib/lesson-drafts";
import { getStaffCourseView } from "@/lib/staff-access-server";
import { getLmsCourse } from "@/lib/lms-catalog";
import { fetchCourseOutline } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const actor = await getRequestUser();
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const user = (await getClassroomSubjectUser(actor)) || actor;
  const viewingAsStudent = user.id !== actor.id;
  if (!viewingAsStudent) await provisionStudentCommerceAccount(user);
  const courseParam = new URL(request.url).searchParams.get("course");
  const courseId = getLmsCourse(courseParam)?.id;
  const [outline, entitlement, previewIds, staffView] = await Promise.all([
    fetchCourseOutline({ courseId }),
    getEntitlementRecord(user.id),
    listPreviewLessonIds(),
    getStaffCourseView(),
  ]);
  const view = viewingAsStudent ? "student_gates" : staffView;
  return NextResponse.json({
    outline: canViewDraftLessons(user, view) ? outline : publishedOutline(outline),
    entitlement: entitlement.accessActive ? entitlement.status : "none",
    entitlement_source: entitlement.source,
    preview_lesson_ids: previewIds,
  });
}
