"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CoursePhaseAccordions from "@/components/course/CoursePhaseAccordions";
import { useStudentSession } from "@/lib/student-session";
import { useStudentNav } from "@/lib/student-nav";

const RESERVED = new Set(["inbox", "notifications", "planner", "overview", "login"]);

export default function StudentCourseNav() {
  const { outline, completed, submissions } = useStudentSession();
  const nav = useStudentNav();
  const pathname = usePathname();
  const segment = pathname.startsWith("/student/") ? pathname.split("/")[2] : null;
  const activeLessonId = segment && !RESERVED.has(segment) ? segment : null;
  const onDashboard = pathname === "/student";
  const onOverview = pathname === "/student/overview";
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const total = lessons.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const close = () => nav?.setOpen(false);

  return (
    <>
      <div className="course-head">
        <nav className="student-nav-buttons" aria-label="Student pages">
          <Link href="/student" className={`dash-link ${onDashboard ? "active" : ""}`} onClick={close}>
            Student Dashboard
          </Link>
          <Link href="/student/overview" className={`dash-link ${onOverview ? "active" : ""}`} onClick={close}>
            Course Overview
          </Link>
        </nav>
        <h2>Course modules</h2>
        <p className="muted">IAC Skills Course</p>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small">
          {done} of {total} lessons complete
        </p>
      </div>
      <CoursePhaseAccordions
        chapters={outline}
        completed={completed}
        activeLessonId={activeLessonId}
        basePath="/student"
        onNavigate={close}
        variant="nav"
        submissions={submissions}
      />
    </>
  );
}
