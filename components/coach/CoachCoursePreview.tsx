"use client";

import CoursePhaseAccordions from "@/components/course/CoursePhaseAccordions";
import type { OutlineChapter } from "@/lib/student-lesson";

export default function CoachCoursePreview({ outline }: { outline: OutlineChapter[] }) {
  const lessons = outline.flatMap((chapter) => chapter.lessons);

  return (
    <article className="lesson-body wide student-dash coach-course-preview">
      <p className="kicker">Course preview</p>
      <h1>Full course</h1>
      <p className="lead">
        This is an unlocked coach view of the live course. Students still follow sequential access and submission
        gates. {lessons.length} lessons.
      </p>
      <CoursePhaseAccordions
        chapters={outline}
        completed={{}}
        basePath="/coach/preview"
        variant="hub"
        unlocked
      />
    </article>
  );
}
