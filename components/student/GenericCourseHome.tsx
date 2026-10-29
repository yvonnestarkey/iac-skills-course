"use client";

import Link from "next/link";
import { findResumeLesson } from "@/lib/course-phases";
import { useCoursePreview } from "@/lib/course-preview";
import { useLmsCourse } from "@/lib/lms-course-context";
import { useStudentSession } from "@/lib/student-session";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

export default function GenericCourseHome() {
  const { course } = useLmsCourse();
  const { user, completed } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { basePath } = useCoursePreview();
  const chapters = outline || [];
  const lessons = chapters.flatMap((chapter) => chapter.lessons || []);
  const done = lessons.filter((lesson) => completed?.[lesson.id]).length;
  const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
  const name = user?.full_name?.trim() || (user?.email ? user.email.split("@")[0] : "there");
  const resume = findResumeLesson(chapters, completed || {});
  const empty = lessons.length === 0;

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">{course.title}</p>
      <h1>Welcome back, {name}</h1>
      {empty ? (
        <>
          <p className="lead">This classroom is ready. There are no lessons yet.</p>
          <p className="muted">
            Import the Thinkific export into this course to fill the modules. Nothing here is placeholder lesson
            content.
          </p>
        </>
      ) : (
        <>
          <div className="student-progress-row">
            <strong className="student-progress-pct">{pct}% Complete</strong>
            <div className="student-progress" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>
          {resume?.lesson && resume.chapter ? (
            <section className="resume-banner">
              <div>
                <p className="kicker">{done === lessons.length ? "Course complete" : "Resume course"}</p>
                <strong>{resume.lesson.title}</strong>
                <p className="muted small">{resume.chapter.title}</p>
              </div>
              <Link className="primary" href={`${basePath}/${resume.lesson.id}`}>
                {done === lessons.length ? "Review last lesson" : done ? "Resume Course" : "Start Course"}
              </Link>
            </section>
          ) : null}
        </>
      )}
    </article>
  );
}
