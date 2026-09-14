"use client";

import Link from "next/link";
import StudentPersonalNotes from "@/components/student/StudentPersonalNotes";
import { ICONS } from "@/lib/constants";
import { useStudentInbox } from "@/lib/use-student-inbox";
import { useStudentSession } from "@/lib/student-session";

export default function StudentDashboard() {
  const { user, outline, completed } = useStudentSession();
  const { inboxWaiting, unreadCount } = useStudentInbox();
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const next = lessons.find((lesson) => !completed[lesson.id]) || lessons[0];
  const name = user?.email ? user.email.split("@")[0] : "there";
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;

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
      <div className="actions">
        {next ? (
          <Link className="primary" href={`/student/${next.id}`}>
            {done ? "Continue learning" : "Start the course"}
          </Link>
        ) : null}
      </div>
      <nav className="student-hub" aria-label="Student shortcuts">
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
      {outline.map((chapter) => {
        const chapterDone = chapter.lessons.filter((lesson) => completed[lesson.id]).length;
        return (
          <section className="student-dash-chapter" key={chapter.id}>
            <h2>{chapter.title}</h2>
            <p className="muted small">
              {chapterDone} of {chapter.lessons.length} complete
              {chapter.summary ? ` · ${chapter.summary}` : ""}
            </p>
            <ul className="student-dash-lessons">
              {chapter.lessons.map((lesson) => (
                <li key={lesson.id}>
                  <Link href={`/student/${lesson.id}`}>
                    <span className="icon">{completed[lesson.id] ? "✓" : ICONS[lesson.type]}</span>
                    <span>{lesson.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </article>
  );
}
