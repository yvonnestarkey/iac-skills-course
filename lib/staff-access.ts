import { isCoachAccount } from "@/lib/roles";
import type { AccessResult } from "@/lib/accessControl";
import { composeLessonAvailability, type ComposedLessonAccess } from "@/lib/lesson-availability";

export const STAFF_COURSE_VIEW_COOKIE = "staff_course_view";
export type StaffCourseView = "override" | "student_gates";

export const STAFF_TEST_ATTEMPT_SOURCE = "staff_test";
export const STUDENT_ATTEMPT_SOURCE = "student";

export function parseStaffCourseView(value: string | null | undefined): StaffCourseView {
  return value === "student_gates" ? "student_gates" : "override";
}

export function staffOverrideApplies(
  user: { email?: string | null; role?: string | null; app_metadata?: Record<string, unknown> | null } | null | undefined,
  view: StaffCourseView = "override"
): boolean {
  return isCoachAccount(user) && view === "override";
}

export function staffCanOpenEveryLesson(user: Parameters<typeof staffOverrideApplies>[0], view: StaffCourseView): boolean {
  return staffOverrideApplies(user, view);
}

export function staffCanOpenEvaluatorWithoutTask1(
  user: Parameters<typeof staffOverrideApplies>[0],
  view: StaffCourseView,
  hasTask1Submission: boolean
): boolean {
  return staffOverrideApplies(user, view) || hasTask1Submission;
}

export function staffOverrideCreatesPurchase(): false {
  return false;
}

export function staffOverrideCreatesEntitlement(): false {
  return false;
}

export function staffOverrideCreatesProgression(): false {
  return false;
}

export function attemptSourceForUser(user: Parameters<typeof isCoachAccount>[0]): typeof STAFF_TEST_ATTEMPT_SOURCE | typeof STUDENT_ATTEMPT_SOURCE {
  return isCoachAccount(user) ? STAFF_TEST_ATTEMPT_SOURCE : STUDENT_ATTEMPT_SOURCE;
}

export function isGenuineStudentAttempt(attempt: { source?: string | null; user_id?: string }, staffUserIds: string[] = []): boolean {
  if (attempt.source === STAFF_TEST_ATTEMPT_SOURCE) return false;
  if (attempt.user_id && staffUserIds.includes(attempt.user_id)) return false;
  return true;
}

export function composeStaffAwareLessonAccess(input: {
  user: Parameters<typeof staffOverrideApplies>[0];
  view: StaffCourseView;
  commercialCanRead: boolean;
  isPreviewLesson?: boolean;
  pedagogical: AccessResult;
  forceOverride?: boolean;
}): ComposedLessonAccess {
  if (input.forceOverride || staffOverrideApplies(input.user, input.view)) {
    return { layer: "open", canReadBody: true, access: { isLocked: false } };
  }
  return composeLessonAvailability({
    commercialCanRead: input.commercialCanRead,
    isPreviewLesson: input.isPreviewLesson,
    pedagogical: input.pedagogical,
  });
}

export function readStaffCourseViewFromCookieHeader(cookieHeader: string | null | undefined): StaffCourseView {
  const match = (cookieHeader || "").match(new RegExp(`(?:^|; )${STAFF_COURSE_VIEW_COOKIE}=([^;]*)`));
  return parseStaffCourseView(match?.[1] ? decodeURIComponent(match[1]) : null);
}

export function writeStaffCourseViewCookie(view: StaffCourseView): string {
  return `${STAFF_COURSE_VIEW_COOKIE}=${view}; Path=/; Max-Age=31536000; SameSite=Lax`;
}
