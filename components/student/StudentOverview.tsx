"use client";

import Link from "next/link";
import PurchaseCta from "@/components/commerce/PurchaseCta";
import CoursePhaseAccordions from "@/components/course/CoursePhaseAccordions";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import { usePreviewNavState } from "@/lib/preview-nav";
import { useStudentSession } from "@/lib/student-session";

export default function StudentOverview() {
  const { outline, completed, submissions, surveyReviews } = useStudentSession();
  const { basePath } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const { markPreviewNav, previewLessonIds } = usePreviewNavState();
  const chapters = outline || [];
  const lessons = chapters.flatMap((chapter) => chapter.lessons || []);
  const done = lessons.filter((lesson) => completed?.[lesson.id]).length;
  const ordered = splitCoursePhases(chapters).flatMap((phase) => phase.chapters || []);
  const resume = findResumeLesson(ordered, completed || {});
  const allDone = lessons.length > 0 && done === lessons.length;

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">Course overview</p>
      <h1>Your course</h1>
      <p className="lead">
        {bypassLocks
          ? "This is the student course with every lesson open. Expand any section to read the titles and open the content."
          : "Expand any section to preview upcoming titles. Locked lessons stay closed until you finish the work before them."}
      </p>

      {bypassLocks ? null : <PurchaseCta compact />}

      {resume?.lesson && resume.chapter ? (
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

      <CoursePhaseAccordions
        chapters={chapters}
        completed={completed || {}}
        basePath={basePath}
        variant="hub"
        submissions={submissions || {}}
        surveyReviews={surveyReviews || {}}
        unlocked={bypassLocks}
        markPreviewNav={markPreviewNav}
        previewLessonIds={previewLessonIds}
      />
    </article>
  );
}
