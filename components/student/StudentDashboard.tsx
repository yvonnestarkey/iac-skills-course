"use client";

import Link from "next/link";
import StudentPersonalNotes from "@/components/student/StudentPersonalNotes";
import { useStudentInbox } from "@/lib/use-student-inbox";
import { useStudentSession } from "@/lib/student-session";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";

export default function StudentDashboard() {
  const { user, outline, completed } = useStudentSession();
  const { inboxWaiting, unreadCount } = useStudentInbox();
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const name = user?.email ? user.email.split("@")[0] : "there";
  const ordered = splitCoursePhases(outline).flatMap((phase) => phase.chapters);
  const resume = findResumeLesson(ordered, completed);
  const allDone = lessons.length > 0 && done === lessons.length;

  return (
    <article className="lesson-body wide student-dash">
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
          <Link className="primary" href={`/student/${resume.lesson.id}`}>
            {allDone ? "Review last lesson" : done ? "Resume Course" : "Start Course"}
          </Link>
        </section>
      ) : null}

      <nav className="student-hub" aria-label="Student shortcuts">
        <Link href="/student/overview" className="student-hub-card">
          <strong>Course Overview</strong>
          <p>Browse every section and task, including locked upcoming titles.</p>
        </Link>
        <Link href="/student/inbox" className="student-hub-card">
          <strong>Inbox</strong>
          <p>Questions and replies with your coach.</p>
          {inboxWaiting ? <span className="pill">New reply</span> : null}
        </Link>
        <Link href="/student/notifications" className="student-hub-card">
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
