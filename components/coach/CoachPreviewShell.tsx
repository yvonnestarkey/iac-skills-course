"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Bell, Mail } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import StudentCourseNav from "@/components/student/StudentCourseNav";
import { COURSE_PREVIEW_BASE } from "@/lib/course-preview";
import { useStudentSession } from "@/lib/student-session";
import { useStudentNav } from "@/lib/student-nav";

export default function CoachPreviewShell({ children }: { children: ReactNode }) {
  const { ready } = useStudentSession();
  const nav = useStudentNav();
  const pathname = usePathname();
  const router = useRouter();
  const closeNav = nav?.setOpen;

  useEffect(() => {
    closeNav?.(false);
  }, [pathname, closeNav]);

  if (!ready) {
    return (
      <div className="student-player">
        <div className="coach-preview-chrome">
          <div className="coach-preview-banner">
            <strong>Previewing Course as Student</strong>
            <button className="primary" type="button" onClick={() => router.push("/coach")}>
              Back to Coach Dashboard
            </button>
          </div>
          <header className="student-player-bar">
            <BrandMark href={COURSE_PREVIEW_BASE} />
          </header>
        </div>
        <p className="student-loading">Loading the course…</p>
      </div>
    );
  }

  return (
    <div className="student-player">
      <div className="coach-preview-chrome">
        <div className="coach-preview-banner">
          <span>
            <span className="coach-view-pill">Coach View</span>
            <strong>Previewing Course as Student</strong>
          </span>
          <button className="primary" type="button" onClick={() => router.push("/coach")}>
            Back to Coach Dashboard
          </button>
        </div>
        <header className="topbar">
          <BrandMark href={COURSE_PREVIEW_BASE} />
          <div className="topbar-right flex items-center gap-2 flex-wrap">
            <button
              className={`notify-btn ${pathname.startsWith("/coach/inbox") ? "on" : ""}`}
              type="button"
              aria-label="Inbox"
              onClick={() => router.push("/coach/inbox")}
            >
              <Mail size={18} aria-hidden="true" />
            </button>
            <button
              className={`notify-btn ${pathname.startsWith("/coach/notifications") ? "on" : ""}`}
              type="button"
              aria-label="Notifications"
              onClick={() => router.push("/coach/notifications")}
            >
              <Bell size={18} aria-hidden="true" />
            </button>
            {nav ? (
              <button
                className={`course-menu-btn ${nav.open ? "on" : ""}`}
                aria-expanded={nav.open}
                aria-controls="student-course-nav"
                type="button"
                onClick={nav.toggle}
              >
                {nav.open ? "Close" : "Course"}
              </button>
            ) : null}
          </div>
        </header>
      </div>
      <div className="shell">
        {nav?.open ? (
          <button className="nav-backdrop" aria-label="Close course menu" type="button" onClick={() => nav.setOpen(false)} />
        ) : null}
        <aside id="student-course-nav" className={`sidebar ${nav?.open ? "nav-open" : ""}`}>
          <StudentCourseNav />
        </aside>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
