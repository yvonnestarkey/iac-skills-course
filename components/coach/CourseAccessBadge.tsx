import { courseAccessFromEntitlementStatus, courseAccessLabel } from "@/lib/course-access";
import type { EntitlementStatus } from "@/lib/commerce";

export default function CourseAccessBadge({ access }: { access?: EntitlementStatus | null }) {
  const status = courseAccessFromEntitlementStatus(access);
  return (
    <span className={`badge course-access-badge ${status === "full" ? "ok" : "warn"}`}>
      {courseAccessLabel(status)}
    </span>
  );
}
