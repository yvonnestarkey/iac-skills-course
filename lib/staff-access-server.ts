import { cookies } from "next/headers";
import { parseStaffCourseView, STAFF_COURSE_VIEW_COOKIE, type StaffCourseView } from "@/lib/staff-access";

export async function getStaffCourseView(): Promise<StaffCourseView> {
  const store = await cookies();
  return parseStaffCourseView(store.get(STAFF_COURSE_VIEW_COOKIE)?.value);
}
