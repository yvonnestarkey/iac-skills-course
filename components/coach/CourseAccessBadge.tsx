import { courseAccessLabel } from "@/lib/course-access";
import type { EntitlementStatus } from "@/lib/commerce";

export default function CourseAccessBadge({
  access,
  accessActive = true,
}: {
  access?: EntitlementStatus | null;
  accessActive?: boolean;
}) {
  const label = courseAccessLabel(access, accessActive);
  return (
    <span className={`badge course-access-badge ${label === "Full Course" ? "ok" : "warn"}`}>
      {label}
    </span>
  );
}
