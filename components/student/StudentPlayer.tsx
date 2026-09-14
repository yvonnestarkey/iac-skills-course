"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import VideoPlayer from "@/components/lesson/VideoPlayer";
import StudentCoachThread from "@/components/student/StudentCoachThread";
import { fetchLessonProgress, saveLessonProgress, type StudentLesson } from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";
import type { LessonType } from "@/lib/types";

const KICKERS: Record<LessonType, string> = {
  video: "Video lesson",
  reading: "Reading",
  assignment: "Written assignment",
  upload: "File upload",
  ask: "Ask your coach",
  survey: "Check-in",
};

export default function StudentPlayer({ lesson }: { lesson: StudentLesson }) {
  const { setLessonCompleted } = useStudentSession();
  const [completed, setCompleted] = useState(false);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const result = await fetchLessonProgress(lesson.id);
      if (cancelled) return;
      setCompleted(result.progress.completed);
      setNotes(result.progress.notes);
    };

    load();
    return () => {
      cancelled = true;
      if (notesTimer.current) clearTimeout(notesTimer.current);
    };
  }, [lesson.id]);

  const persist = async (next: { completed: boolean; notes: string }, silent = false) => {
    const result = await saveLessonProgress(lesson.id, next);
    if (result.ok) {
      setLessonCompleted(lesson.id, next.completed);
      if (!silent) setStatus("Saved.");
    } else {
      setStatus(result.error || "Could not save.");
    }
  };

  const markComplete = async () => {
    const next = !completed;
    setCompleted(next);
    setLessonCompleted(lesson.id, next);
    await persist({ completed: next, notes }, false);
  };

  const onNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      persist({ completed: completedRef.current, notes: value }, true);
    }, 700);
  };

  return (
    <>
      {lesson.video_url?.includes("player.vimeo.com") || lesson.type === "video" ? (
        <VideoPlayer lesson={lesson} />
      ) : lesson.type === "reading" ? (
        <div className="reading-hero">
          <span>{lesson.duration}</span>
          <p>{lesson.blurb}</p>
        </div>
      ) : null}

      <article className="lesson-body">
        <p className="kicker">
          {lesson.chapterTitle} · {KICKERS[lesson.type]}
        </p>
        <h1>{lesson.title}</h1>
        {status ? <p className="notice">{status}</p> : null}
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

        <label className="student-notes-label" htmlFor="student-notes">
          Your notes
        </label>
        <textarea
          id="student-notes"
          rows={6}
          placeholder="Write notes for this lesson…"
          value={notes}
          onChange={(event) => onNotesChange(event.target.value)}
          onBlur={() => persist({ completed, notes }, true)}
        />

        <div className="actions">
          <button className={completed ? "ghost" : "primary"} type="button" onClick={markComplete}>
            {completed ? "Completed ✓" : "Mark as complete"}
          </button>
          {lesson.next ? (
            <Link className="ghost" href={`/student/${lesson.next.id}`}>
              Next: {lesson.next.title} →
            </Link>
          ) : null}
        </div>
        {lesson.type === "ask" || lesson.type === "assignment" || lesson.type === "upload" ? (
          <StudentCoachThread
            compact
            title={lesson.type === "ask" ? "Ask the Coach" : "Message your coach about this work"}
            context={`${lesson.chapterTitle} · ${lesson.title}`}
            lessonId={lesson.id}
          />
        ) : null}
      </article>
    </>
  );
}
