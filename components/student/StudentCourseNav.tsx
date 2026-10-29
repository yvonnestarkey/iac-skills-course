"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CoursePhaseAccordions from "@/components/course/CoursePhaseAccordions";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import { usePreviewNavState } from "@/lib/preview-nav";
import { useStudentSession } from "@/lib/student-session";
import { useStudentNav } from "@/lib/student-nav";
import { DEFAULT_LMS_COURSE_ID } from "@/lib/lms-catalog";
import { useLmsCourse } from "@/lib/lms-course-context";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

const RESERVED = new Set(["inbox", "notifications", "planner", "overview", "login", "coaching", "events", "surveys", "feedback", "evaluator", "dashboard", "account", "bmcr", "volume-accuracy", "buried-treasure", "reading", "study-clinic"]);

export default function StudentCourseNav() {
  const { course, classroomPath } = useLmsCourse();
  const { completed, submissions, surveyReviews } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { unlocked, basePath } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const { markPreviewNav, previewLessonIds } = usePreviewNavState();
  const nav = useStudentNav();
  const pathname = usePathname();
  const prefix = `${basePath}/`;
  const chapters = outline || [];
  const segment = pathname.startsWith(prefix) ? pathname.slice(prefix.length).split("/")[0] : null;
  const activeLessonId = segment && !RESERVED.has(segment) ? segment : null;
  const iac = course.id === DEFAULT_LMS_COURSE_ID;
  const dashHref = unlocked ? basePath : iac ? "/student/dashboard" : classroomPath || basePath;
  const onDashboard = pathname === basePath || pathname === dashHref || pathname === "/student/dashboard";
  const onStudyClinic = pathname.startsWith("/student/study-clinic");
  const onOverview = pathname === `${basePath}/overview`;
  const lessons = chapters.flatMap((chapter) => chapter.lessons || []);
  const done = lessons.filter((lesson) => completed?.[lesson.id]).length;
  const total = lessons.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const close = () => nav?.setOpen(false);

  return (
    <>
      <div className="course-head">
        <nav className="student-nav-buttons" aria-label="Student pages">
          <Link href={dashHref} className={`dash-link ${onDashboard ? "active" : ""}`} onClick={close}>
            Student Dashboard
          </Link>
          {iac ? (
            <Link href="/student/study-clinic" className={`dash-link ${onStudyClinic ? "active" : ""}`} onClick={close}>
              Study Clinic
            </Link>
          ) : null}
          <Link href={`${basePath}/overview`} className={`dash-link ${onOverview ? "active" : ""}`} onClick={close}>
            Course Overview
          </Link>
        </nav>
        <h2>Course modules</h2>
        <p className="muted">{course.shortTitle}</p>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small">
          {done} of {total} lessons complete
        </p>
      </div>
      <CoursePhaseAccordions
        chapters={chapters}
        completed={completed || {}}
        activeLessonId={activeLessonId}
        basePath={basePath}
        onNavigate={close}
        variant="nav"
        submissions={submissions || {}}
        surveyReviews={surveyReviews || {}}
        unlocked={bypassLocks}
        markPreviewNav={markPreviewNav}
        previewLessonIds={previewLessonIds}
      />
    </>
  );
}
