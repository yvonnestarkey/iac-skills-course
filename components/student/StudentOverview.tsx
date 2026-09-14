"use client";

import Link from "next/link";
import CoursePhaseAccordions from "@/components/course/CoursePhaseAccordions";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { useStudentSession } from "@/lib/student-session";

export default function StudentOverview() {
  const { outline, completed } = useStudentSession();
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const ordered = splitCoursePhases(outline).flatMap((phase) => phase.chapters);
  const resume = findResumeLesson(ordered, completed);
  const allDone = lessons.length > 0 && done === lessons.length;

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">Course overview</p>
      <h1>Your course</h1>
      <p className="lead">Expand any section to preview upcoming titles. Locked lessons stay closed until you finish the work before them.</p>

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

      <CoursePhaseAccordions chapters={outline} completed={completed} basePath="/student" variant="hub" />
    </article>
  );
}
