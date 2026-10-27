"use client";

import Link from "next/link";
import { studyClinicVideos } from "@/lib/study-clinic";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

export default function StudyClinic() {
  const outline = useVisibleCourseOutline();
  const videos = studyClinicVideos(outline);

  return (
    <article className="lesson-body wide">
      <p>
        <Link href="/student/dashboard">← Student dashboard</Link>
      </p>
      <p className="kicker">Study Clinic</p>
      <h1>Common Fixes</h1>
      <p className="lead">Short videos for the study problems that get in the way. Open the one you need.</p>
      {videos.length ? (
        <nav className="study-clinic-list" aria-label="Study Clinic videos">
          {videos.map((lesson) => (
            <Link key={lesson.id} className="study-clinic-btn" href={`/student/study-clinic/${lesson.id}`}>
              <strong>{lesson.title}</strong>
              {lesson.duration ? <span className="muted small">{lesson.duration}</span> : null}
            </Link>
          ))}
        </nav>
      ) : (
        <p className="empty">No Study Clinic videos are published yet.</p>
      )}
    </article>
  );
}
