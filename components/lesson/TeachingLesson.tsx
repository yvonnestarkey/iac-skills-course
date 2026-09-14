"use client";

import { useStore } from "@/lib/store";
import type { FlatLesson } from "@/lib/types";
import LessonPdfViewer from "@/components/LessonPdfViewer";
import { LessonHeader, NextLessonButton } from "./LessonChrome";
import VideoPlayer from "./VideoPlayer";

export default function TeachingLesson({ lesson }: { lesson: FlatLesson }) {
  const { student, mutate } = useStore();
  if (!student) return null;
  const done = (student.completed || []).includes(lesson.id);

  const markComplete = () => {
    mutate((draft) => {
      const target = draft.students.find((s) => s.id === student.id);
      target.completed = target.completed || [];
      if (!target.completed.includes(lesson.id)) target.completed.push(lesson.id);
    });
  };

  return (
    <>
      {lesson.type === "video" ? (
        <VideoPlayer lesson={lesson} />
      ) : (
        <div className="reading-hero">
          <span>{lesson.duration}</span>
          <p>{lesson.blurb}</p>
        </div>
      )}
      <article className="lesson-body">
        <LessonHeader lesson={lesson} kicker={lesson.type === "video" ? "Video lesson" : "Reading"} />
        <p className="lead">{lesson.blurb}</p>
        {(lesson.body || []).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
        {(lesson.takeaways || []).length ? (
          <div className="takeaways">
            <h3>Takeaways</h3>
            <ul>
              {lesson.takeaways.map((t, i) => (
                <li key={i}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <LessonPdfViewer pdfUrl={lesson.pdf_url} />
        <div className="actions">
          <button className={done ? "ghost" : "primary"} id="complete" onClick={markComplete}>
            {done ? "Completed ✓" : "Mark as complete"}
          </button>
          <NextLessonButton lesson={lesson} />
        </div>
      </article>
    </>
  );
}
