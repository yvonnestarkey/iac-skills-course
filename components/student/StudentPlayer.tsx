"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import LessonResources from "@/components/LessonResources";
import VideoPlayer, { embedSrcForVideo } from "@/components/lesson/VideoPlayer";
import StudentCoachThread from "@/components/student/StudentCoachThread";
import LessonSubmissionForm from "@/components/student/LessonSubmissionForm";
import { fetchLessonProgress, saveLessonProgress, type StudentLesson } from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";
import { catalogFromOutline, checkLessonAccess, outlineToGate, type AccessResult } from "@/lib/accessControl";
import { findResumeLesson, isChapterSequentiallyLocked, splitCoursePhases } from "@/lib/course-phases";
import { useCoursePreview } from "@/lib/course-preview";
import type { LessonType } from "@/lib/types";

const KICKERS: Record<LessonType, string> = {
  video: "Video lesson",
  reading: "Reading",
  assignment: "Written assignment",
  upload: "File upload",
  ask: "Ask your coach",
  survey: "Check-in",
};

export default function StudentPlayer({
  lesson,
  initialAccess,
}: {
  lesson: StudentLesson;
  initialAccess?: AccessResult;
}) {
  const { user, setLessonCompleted, setSubmission, outline, completed: completedMap, submissions } = useStudentSession();
  const { unlocked, basePath } = useCoursePreview();
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

  const ordered = splitCoursePhases(outline).flatMap((phase) => phase.chapters);
  const catalog = useMemo(() => catalogFromOutline(outline), [outline]);
  const liveAccess = checkLessonAccess(outlineToGate(lesson), catalog, submissions);
  const access = catalog.length ? liveAccess : initialAccess || liveAccess;
  const chapterLocked = outline.length > 0 && isChapterSequentiallyLocked(outline, lesson.chapterId, completedMap);
  const resume = findResumeLesson(ordered, completedMap);
  const showSubmission = lesson.requires_submission === true || lesson.requires_coach_approval === true;

  if (!unlocked && access.isLocked) {
    return (
      <article className="lesson-body">
        <p className="kicker">Locked lesson</p>
        <h1>This lesson is still closed</h1>
        <p className="lead">{access.reason}</p>
        <div className="actions">
          {access.prereqLessonId ? (
            <Link className="primary" href={`${basePath}/${access.prereqLessonId}`}>
              Open {access.prereqTitle}
            </Link>
          ) : resume ? (
            <Link className="primary" href={`${basePath}/${resume.lesson.id}`}>
              Resume Course
            </Link>
          ) : null}
        </div>
      </article>
    );
  }

  if (!unlocked && chapterLocked && resume && resume.lesson.id !== lesson.id) {
    return (
      <article className="lesson-body">
        <p className="kicker">Locked lesson</p>
        <h1>This lesson is still closed</h1>
        <p className="lead">Finish the previous section first. Resume at {resume.lesson.title}.</p>
        <div className="actions">
          <Link className="primary" href={`${basePath}/${resume.lesson.id}`}>
            Resume Course
          </Link>
        </div>
      </article>
    );
  }

  return (
    <>
      {embedSrcForVideo(lesson.video_url) || lesson.type === "video" ? (
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

        <LessonResources pdfUrl={lesson.pdf_url} />

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
            <Link className="ghost" href={`${basePath}/${lesson.next.id}`}>
              Next: {lesson.next.title} →
            </Link>
          ) : null}
        </div>
        {showSubmission && user ? (
          <LessonSubmissionForm
            lessonId={lesson.id}
            studentId={user.id}
            requiresCoachApproval={Boolean(lesson.requires_coach_approval)}
            saved={submissions[lesson.id]}
            onSaved={(submission) => {
              setSubmission(lesson.id, submission);
              setCompleted(true);
              setLessonCompleted(lesson.id, true);
              persist({ completed: true, notes }, true);
            }}
          />
        ) : null}
        {lesson.type === "ask" || showSubmission ? (
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
