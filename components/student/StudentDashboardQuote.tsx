"use client";

import { dashboardQuoteForDate } from "@/lib/dashboard-quotes";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useLmsCourse } from "@/lib/lms-course-context";

export default function StudentDashboardQuote() {
  const { course } = useLmsCourse();
  if (course.id !== DEFAULT_LMS_COURSE_ID) return null;
  const quote = dashboardQuoteForDate();
  return (
    <figure className="dashboard-quote-card" style={{ color: quote.color }}>
      <blockquote>“{quote.text}”</blockquote>
      <figcaption>— {quote.source}</figcaption>
    </figure>
  );
}
