import { DEFAULT_PRODUCT_ID, type EntitlementStatus } from "@/lib/commerce";

export type CourseAccessFilter = "all" | EntitlementStatus;

export const COURSE_ACCESS_FILTERS: { id: CourseAccessFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "free_preview", label: "Free Preview" },
  { id: "full", label: "Full Course" },
];

/** Display-only. Authoritative value is course_entitlements.status for jan27-iac. */
export function courseAccessFromEntitlementStatus(status: unknown): EntitlementStatus {
  return status === "full" ? "full" : "free_preview";
}

export function courseAccessLabel(status: EntitlementStatus | null | undefined): "Free Preview" | "Full Course" {
  return courseAccessFromEntitlementStatus(status) === "full" ? "Full Course" : "Free Preview";
}

export function filterStudentsByCourseAccess<T extends { courseAccess?: EntitlementStatus | null }>(
  students: T[],
  filter: CourseAccessFilter
): T[] {
  if (filter === "all") return students;
  return students.filter((student) => courseAccessFromEntitlementStatus(student.courseAccess) === filter);
}

export function entitlementsByUserId(
  rows: Array<{ user_id: string; status: unknown; product_id?: string | null }>,
  productId = DEFAULT_PRODUCT_ID
): Map<string, EntitlementStatus> {
  const map = new Map<string, EntitlementStatus>();
  for (const row of rows) {
    if (row.product_id && row.product_id !== productId) continue;
    map.set(row.user_id, courseAccessFromEntitlementStatus(row.status));
  }
  return map;
}
