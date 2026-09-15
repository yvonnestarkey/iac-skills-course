"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StudentDashboardBanner from "@/components/student/StudentDashboardBanner";
import StudentPersonalNotes from "@/components/student/StudentPersonalNotes";
import { fetchCoachingDashboardHint } from "@/lib/coaching";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { useCoursePreview } from "@/lib/course-preview";
import { useStudentInbox } from "@/lib/use-student-inbox";
import { useStudentSession } from "@/lib/student-session";

export default function StudentDashboard() {
  const { user, outline, completed } = useStudentSession();
  const { unlocked, basePath } = useCoursePreview();
  const { inboxWaiting, unreadCount } = useStudentInbox();
  const [coachingUnseen, setCoachingUnseen] = useState(false);
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const name = unlocked ? "Coach" : user?.email ? user.email.split("@")[0] : "there";
  const ordered = splitCoursePhases(outline).flatMap((phase) => phase.chapters);
  const resume = findResumeLesson(ordered, completed);
  const allDone = lessons.length > 0 && done === lessons.length;
  const inboxHref = unlocked ? "/coach/inbox" : "/student/inbox";
  const notifyHref = unlocked ? "/coach/notifications" : "/student/notifications";

  useEffect(() => {
    if (!user?.id || unlocked) return;
    fetchCoachingDashboardHint(user.id).then((hint) => setCoachingUnseen(hint.unseenDeliverables));
  }, [user?.id, unlocked]);

  return (
    <article className="lesson-body wide student-dash">
      <StudentDashboardBanner />
      <p className="kicker">Student dashboard</p>
      <h1>Welcome back, {name}</h1>
      <div className="student-progress-row">
        <strong className="student-progress-pct">{pct}% Complete</strong>
        <div className="student-progress" aria-hidden="true">
          <span style={{ width: `${pct}%` }} />
        </div>
      </div>

      {resume ? (
        <section className="resume-banner">
          <div>
            <p className="kicker">{allDone ? "Course complete" : "Resume course"}</p>
            <strong>{resume.lesson.title}</strong>
            <p className="muted small">{resume.chapter.title}</p>
          </div>
          <Link className="primary" href={`${basePath}/${resume.lesson.id}`}>
            {allDone ? "Review last lesson" : done ? "Resume Course" : "Start Course"}
          </Link>
        </section>
      ) : null}

      <nav className="student-hub" aria-label="Student shortcuts">
        <Link href="/student/coaching" className="student-hub-card">
          <strong>1-on-1 Coaching</strong>
          <p>Book a private session or access your meeting summaries and recordings.</p>
          {coachingUnseen ? <span className="pill">Meeting Summary & Recording Available</span> : null}
        </Link>
        <Link href={`${basePath}/overview`} className="student-hub-card">
          <strong>Course Overview</strong>
          <p>
            {unlocked
              ? "Browse every section and task with no student access gates."
              : "Browse every section and task, including locked upcoming titles."}
          </p>
        </Link>
        <Link href={inboxHref} className="student-hub-card">
          <strong>Inbox</strong>
          <p>Questions and replies with your coach.</p>
          {inboxWaiting ? <span className="pill">New reply</span> : null}
        </Link>
        <Link href={notifyHref} className="student-hub-card">
          <strong>Notifications</strong>
          <p>Assignment feedback and coach notes.</p>
          {unreadCount ? <span className="pill">{unreadCount} unread</span> : null}
        </Link>
        <Link href="/student/planner" className="student-hub-card">
          <strong>Study planner</strong>
          <p>Set your hours, slots, and target finish date.</p>
        </Link>
      </nav>
      <StudentPersonalNotes />
    </article>
  );
}
