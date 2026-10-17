import { DEFAULT_PRODUCT_ID, type CommercialAccess, type EntitlementStatus } from "@/lib/commerce";

export type CourseAccessFilter = "all" | EntitlementStatus | "deregistered";

export const COURSE_ACCESS_FILTERS: { id: CourseAccessFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "free_preview", label: "Free Preview" },
  { id: "full", label: "Full Course" },
  { id: "deregistered", label: "Deregistered" },
];

/** Display-only. Authoritative value is course_entitlements.status for jan27-iac. */
export function courseAccessFromEntitlementStatus(status: unknown): EntitlementStatus {
  return status === "full" ? "full" : "free_preview";
}

export function courseAccessLabel(
  status: EntitlementStatus | CommercialAccess | null | undefined,
  accessActive = true
): "Free Preview" | "Full Course" | "Deregistered" {
  if (status === "none" || accessActive === false) return "Deregistered";
  return courseAccessFromEntitlementStatus(status) === "full" ? "Full Course" : "Free Preview";
}

export function filterStudentsByCourseAccess<T extends { courseAccess?: EntitlementStatus | null; accessActive?: boolean }>(
  students: T[],
  filter: CourseAccessFilter
): T[] {
  if (filter === "all") return students;
  if (filter === "deregistered") return students.filter((student) => student.accessActive === false);
  return students.filter(
    (student) => student.accessActive !== false && courseAccessFromEntitlementStatus(student.courseAccess) === filter
  );
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
