"use client";

import { useStore } from "@/lib/store";
import type { FlatLesson } from "@/lib/types";
import LessonPdfViewer from "@/components/LessonPdfViewer";
import LinkedText from "@/components/ui/LinkedText";
import { firstLessonWebLink } from "@/lib/getLessonPdf";
import { readingHeroDuration } from "@/lib/lesson-duration";
import { resolveCourseHref } from "@/lib/rich-text";
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
          {readingHeroDuration(lesson.duration) ? <span>{readingHeroDuration(lesson.duration)}</span> : null}
          {lesson.blurb ? (
            <p>
              <LinkedText text={lesson.blurb} />
            </p>
          ) : null}
        </div>
      )}
      <article className="lesson-body">
        <LessonHeader lesson={lesson} />
        {lesson.blurb ? (
          <p className="lead">
            <LinkedText text={lesson.blurb} />
          </p>
        ) : null}
        {(lesson.body || []).map((paragraph, i) => (
          <p key={i}>
            <LinkedText text={paragraph} />
          </p>
        ))}
        {(lesson.takeaways || []).length ? (
          <div className="takeaways">
            <h3>Takeaways</h3>
            <ul>
              {lesson.takeaways.map((t, i) => (
                <li key={i}>
                  <LinkedText text={t} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {(() => {
          const link = firstLessonWebLink(lesson);
          const href = link ? resolveCourseHref(link.url) : null;
          if (!link || !href) return null;
          return (
            <a className="primary lesson-resource-link" href={href} target="_blank" rel="noopener noreferrer">
              {link.title}
            </a>
          );
        })()}
        <LessonPdfViewer pdfUrl={lesson.pdf_url} lesson={lesson} />
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
