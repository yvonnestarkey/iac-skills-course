"use client";

import { useLmsCourse } from "@/lib/lms-course-context";

export default function StudentDashboardBanner() {
  const { course } = useLmsCourse();
  if (!course.dashboardBannerUrl) return null;
  return (
    <div className="dashboard-banner-wrap">
      <img className="dashboard-banner" src={course.dashboardBannerUrl} alt={`${course.title} dashboard`} />
    </div>
  );
}
