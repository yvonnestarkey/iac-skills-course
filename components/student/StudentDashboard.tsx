"use client";

import Link from "next/link";
import { ICONS } from "@/lib/constants";
import { useStudentSession } from "@/lib/student-session";

export default function StudentDashboard() {
  const { user, outline, completed } = useStudentSession();
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const next = lessons.find((lesson) => !completed[lesson.id]) || lessons[0];
  const name = user?.email ? user.email.split("@")[0] : "there";

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">Student dashboard</p>
      <h1>Welcome back, {name}</h1>
      <p className="lead">
        {done} of {lessons.length} lessons complete.
        {next ? ` Continue with ${next.title}.` : " You have finished the course."}
      </p>
      <div className="student-progress" aria-hidden="true">
        <span style={{ width: `${lessons.length ? Math.round((done / lessons.length) * 100) : 0}%` }} />
      </div>
      <div className="actions">
        {next ? (
          <Link className="primary" href={`/student/${next.id}`}>
            {done ? "Continue learning" : "Start the course"}
          </Link>
        ) : null}
      </div>
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
