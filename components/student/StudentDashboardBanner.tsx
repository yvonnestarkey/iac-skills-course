"use client";

import Link from "next/link";
import { dashboardQuoteForDate } from "@/lib/dashboard-quotes";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useLmsCourse } from "@/lib/lms-course-context";

export default function StudentDashboardBanner({
  name,
  resumeHref,
  resumeLabel = "Resume Course",
  pct,
  paceMessage,
}: {
  name?: string;
  resumeHref?: string;
  resumeLabel?: string;
  pct?: number;
  paceMessage?: string;
}) {
  const { course } = useLmsCourse();
  if (!course.dashboardBannerUrl) return null;
  const quote = course.id === DEFAULT_LMS_COURSE_ID ? dashboardQuoteForDate() : null;
  const showChrome = Boolean(name || resumeHref);
  return (
    <div className="dashboard-banner-wrap">
      <img className="dashboard-banner" src={course.dashboardBannerUrl} alt={`${course.title} dashboard`} />
      {showChrome ? (
        <>
          {resumeHref ? (
            <Link className="dashboard-banner-resume" href={resumeHref}>
              {resumeLabel}
            </Link>
          ) : null}
          {name ? (
            <div className="dashboard-banner-welcome">
              <h1>Welcome back, {name}</h1>
              {typeof pct === "number" ? (
                <div className="student-progress-row">
                  <strong className="student-progress-pct">{pct}% Complete</strong>
                  <div className="student-progress" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ) : null}
              {paceMessage ? <p className="muted small student-dash-pace">{paceMessage}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}
      {quote ? (
        <figure className="dashboard-banner-quote" style={{ color: quote.color }}>
          <blockquote>“{quote.text}”</blockquote>
          <figcaption>— {quote.source}</figcaption>
        </figure>
      ) : null}
    </div>
  );
}
