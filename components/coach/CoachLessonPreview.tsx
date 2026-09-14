"use client";

import Link from "next/link";
import VideoPlayer, { embedSrcForVideo } from "@/components/lesson/VideoPlayer";
import type { StudentLesson } from "@/lib/student-lesson";
import type { LessonType } from "@/lib/types";

const KICKERS: Record<LessonType, string> = {
  video: "Video lesson",
  reading: "Reading",
  assignment: "Written assignment",
  upload: "File upload",
  ask: "Ask your coach",
  survey: "Check-in",
};

export default function CoachLessonPreview({ lesson }: { lesson: StudentLesson }) {
  return (
    <>
      {embedSrcForVideo(lesson.video_url) || lesson.type === "video" ? (
        <VideoPlayer
          lesson={{
            id: lesson.id,
            type: lesson.type,
            title: lesson.title,
            duration: lesson.duration,
            seconds: lesson.seconds,
            video_url: lesson.video_url,
          }}
        />
      ) : lesson.type === "reading" ? (
        <div className="reading-hero">
          <span>{lesson.duration}</span>
          <p>{lesson.blurb}</p>
        </div>
      ) : null}

      <article className="lesson-body">
        <p className="kicker">
          Coach preview · {lesson.chapterTitle} · {KICKERS[lesson.type]}
        </p>
        <h1>{lesson.title}</h1>
        {lesson.blurb && lesson.type !== "reading" ? <p className="lead">{lesson.blurb}</p> : null}
        {lesson.due ? <p className="lead">Due {lesson.due}</p> : null}
        {lesson.brief ? <p>{lesson.brief}</p> : null}
        {(lesson.body || []).map((paragraph, index) => (
          <p key={`${lesson.id}-body-${index}`}>{paragraph}</p>
        ))}
        {(lesson.takeaways || []).length ? (
          <div className="takeaways">
            <h3>Takeaways</h3>
            <ul>
              {lesson.takeaways!.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {lesson.requires_submission || lesson.requires_coach_approval ? (
          <p className="notice">
            Students must submit work here
            {lesson.requires_coach_approval ? " and wait for coach approval" : ""} before later gated lessons unlock.
          </p>
        ) : null}
        <div className="actions">
          <Link className="ghost" href="/coach/preview">
            ← Course preview
          </Link>
          {lesson.next ? (
            <Link className="primary" href={`/coach/preview/${lesson.next.id}`}>
              Next: {lesson.next.title} →
            </Link>
          ) : null}
        </div>
      </article>
    </>
  );
}
