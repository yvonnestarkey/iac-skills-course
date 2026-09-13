"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ICONS } from "@/lib/constants";
import { useStudentSession } from "@/lib/student-session";
import { useStudentNav } from "@/lib/student-nav";

export default function StudentCourseNav() {
  const { outline, completed } = useStudentSession();
  const nav = useStudentNav();
  const pathname = usePathname();
  const activeLessonId = pathname.startsWith("/student/") ? pathname.split("/")[2] : null;
  const onDashboard = pathname === "/student";
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const total = lessons.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const close = () => nav?.setOpen(false);

  return (
    <>
      <div className="course-head">
        <h2>Course modules</h2>
        <p className="muted">IAC Skills Course</p>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small">
          {done} of {total} lessons complete
        </p>
        <Link href="/student" className={`dash-link ${onDashboard ? "active" : ""}`} onClick={close}>
          Student dashboard
        </Link>
      </div>
      {outline.map((chapter) => (
        <section className="chapter" key={chapter.id}>
          <h3>{chapter.title}</h3>
          {chapter.summary ? <p className="chapter-summary">{chapter.summary}</p> : null}
          {chapter.lessons.map((lesson) => {
            const active = lesson.id === activeLessonId;
            const isDone = Boolean(completed[lesson.id]);
            return (
              <Link
                key={lesson.id}
                href={`/student/${lesson.id}`}
                className={`lesson-link ${active ? "active" : ""} ${lesson.type} ${isDone ? "done" : ""}`}
                onClick={close}
              >
                <span className="icon">{isDone ? "✓" : ICONS[lesson.type]}</span>
                <span className="label">
                  <span className="lesson-title">{lesson.title}</span>
                  <span className="lesson-meta">{isDone ? "Completed" : lesson.duration || lesson.type}</span>
                </span>
              </Link>
            );
          })}
        </section>
      ))}
    </>
  );
}
