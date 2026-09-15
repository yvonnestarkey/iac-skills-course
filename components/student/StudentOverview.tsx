"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import CoursePhaseAccordions from "@/components/course/CoursePhaseAccordions";
import { fetchCoachingDashboardHint } from "@/lib/coaching";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { useCoursePreview } from "@/lib/course-preview";
import { useStudentSession } from "@/lib/student-session";

export default function StudentOverview() {
  const { outline, completed, submissions, user } = useStudentSession();
  const { unlocked, basePath } = useCoursePreview();
  const [coachingUnseen, setCoachingUnseen] = useState(false);
  const lessons = outline.flatMap((chapter) => chapter.lessons);
  const done = lessons.filter((lesson) => completed[lesson.id]).length;
  const ordered = splitCoursePhases(outline).flatMap((phase) => phase.chapters);
  const resume = findResumeLesson(ordered, completed);
  const allDone = lessons.length > 0 && done === lessons.length;

  useEffect(() => {
    if (!user?.id || unlocked) return;
    fetchCoachingDashboardHint(user.id).then((hint) => setCoachingUnseen(hint.unseenDeliverables));
  }, [user?.id, unlocked]);

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">Course overview</p>
      <h1>Your course</h1>
      <p className="lead">
        {unlocked
          ? "This is the student course with every lesson open. Expand any section to read the titles and open the content."
          : "Expand any section to preview upcoming titles. Locked lessons stay closed until you finish the work before them."}
      </p>

      <Link href="/student/coaching" className="student-hub-card student-hub-card-featured coaching-overview-card">
        <strong>1-on-1 Coaching Session</strong>
        <p>Book time with Yvonne, then open your meeting summary and recording when they are ready.</p>
        {coachingUnseen ? <span className="pill">Meeting Summary & Recording Available</span> : null}
      </Link>

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

      <CoursePhaseAccordions
        chapters={outline}
        completed={completed}
        basePath={basePath}
        variant="hub"
        submissions={submissions}
        unlocked={unlocked}
      />
    </article>
  );
}
