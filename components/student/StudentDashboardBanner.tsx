"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import LinkedText from "@/components/ui/LinkedText";
import { fetchPublishedDashboardPost, type DashboardPost } from "@/lib/dashboard-posts";
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
  const [announcement, setAnnouncement] = useState<DashboardPost | null>(null);
  const iac = course.id === DEFAULT_LMS_COURSE_ID;

  useEffect(() => {
    if (!iac) return;
    let cancelled = false;
    fetchPublishedDashboardPost("announcement").then((next) => {
      if (!cancelled) setAnnouncement(next);
    });
    return () => {
      cancelled = true;
    };
  }, [iac]);

  if (!course.dashboardBannerUrl) return null;
  const paragraphs = (announcement?.body || "")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return (
    <div className="dashboard-banner-wrap">
      <img className="dashboard-banner" src={course.dashboardBannerUrl} alt={`${course.title} dashboard`} />
      <div className="dashboard-banner-overlay">
        <div className="dashboard-banner-top">
          <div className="dashboard-banner-heading">
            {iac ? <p className="dashboard-banner-title">Your Dashboard</p> : null}
            {resumeHref ? (
              <Link className="dashboard-banner-resume" href={resumeHref}>
                {resumeLabel}
              </Link>
            ) : null}
          </div>
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
        </div>
        {announcement ? (
          <div className="dashboard-banner-quote dashboard-banner-announcement">
            <p className="kicker">Announcement</p>
            {announcement.title ? <h2>{announcement.title}</h2> : null}
            {paragraphs.map((paragraph) => (
              <p key={paragraph}>
                <LinkedText text={paragraph} />
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
