"use client";

import { dashboardQuoteForDate } from "@/lib/dashboard-quotes";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useLmsCourse } from "@/lib/lms-course-context";

export default function StudentDashboardBanner() {
  const { course } = useLmsCourse();
  if (!course.dashboardBannerUrl) return null;
  const quote = course.id === DEFAULT_LMS_COURSE_ID ? dashboardQuoteForDate() : null;
  return (
    <div className="dashboard-banner-wrap">
      <img className="dashboard-banner" src={course.dashboardBannerUrl} alt={`${course.title} dashboard`} />
      {quote ? (
        <figure className="dashboard-banner-quote" style={{ color: quote.color }}>
          <blockquote>“{quote.text}”</blockquote>
          <figcaption>— {quote.source}</figcaption>
        </figure>
      ) : null}
    </div>
  );
}
