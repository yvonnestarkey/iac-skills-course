"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { ICONS } from "@/lib/constants";
import { useStudentSession } from "@/lib/student-session";
import { useStudentNav } from "@/lib/student-nav";

export default function StudentCourseNav() {
  const { outline, completed } = useStudentSession();
  const nav = useStudentNav();
  const pathname = usePathname();
  const segment = pathname.startsWith("/student/") ? pathname.split("/")[2] : null;
  const reserved = new Set(["inbox", "notifications", "planner"]);
  const activeLessonId = segment && !reserved.has(segment) ? segment : null;
  const onDashboard = pathname === "/student";
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const total = lessons.length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const [openChapters, setOpenChapters] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!activeLessonId) return;
    const chapter = outline.find((item) => item.lessons.some((lesson) => lesson.id === activeLessonId));
    if (chapter) setOpenChapters((current) => ({ ...current, [chapter.id]: true }));
  }, [activeLessonId, outline]);

  const close = () => nav?.setOpen(false);
  const toggleChapter = (id: string) => {
    setOpenChapters((current) => ({ ...current, [id]: !current[id] }));
  };

  return (
    <>
      <div className="course-head">
        <Link href="/student" className={`dash-link ${onDashboard ? "active" : ""}`} onClick={close}>
          Student dashboard
        </Link>
        <h2>Course modules</h2>
        <p className="muted">IAC Skills Course</p>
        <div className="bar">
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small">
          {done} of {total} lessons complete
        </p>
      </div>
      {outline.map((chapter) => {
        const isOpen = Boolean(openChapters[chapter.id]);
        return (
          <section className={`chapter ${isOpen ? "open" : "collapsed"}`} key={chapter.id}>
            <button
              className="chapter-toggle"
              type="button"
              aria-expanded={isOpen}
              onClick={() => toggleChapter(chapter.id)}
            >
              <span>
                <h3>{chapter.title}</h3>
                <span className="muted small">
                  {chapter.lessons.filter((lesson) => completed[lesson.id]).length} of {chapter.lessons.length} complete
                </span>
              </span>
              <span className="chapter-caret" aria-hidden="true">
                {isOpen ? "▾" : "▸"}
              </span>
            </button>
            {isOpen ? (
              <>
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
              </>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
