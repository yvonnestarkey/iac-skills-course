"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { LessonPdfPlaceholder } from "@/components/student/LessonLoadingSkeleton";
import LessonTypeIcon from "@/components/lesson/LessonTypeIcon";
import StudentCoachThread from "@/components/student/StudentCoachThread";
import LessonSubmissionForm from "@/components/student/LessonSubmissionForm";
import StudentSurveyForm from "@/components/student/StudentSurveyForm";
import { fetchLessonProgress, saveLessonProgress, type StudentLesson } from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";
import { catalogFromOutline, checkLessonAccess, outlineToGate, type AccessResult } from "@/lib/accessControl";
import { findResumeLesson, isChapterSequentiallyLocked, splitCoursePhases } from "@/lib/course-phases";
import { useCoursePreview } from "@/lib/course-preview";
import { displayLessonType, lessonTypeLabel } from "@/lib/lesson-type";

const LessonPdfViewer = dynamic(() => import("@/components/LessonPdfViewer"), {
  ssr: false,
  loading: () => <LessonPdfPlaceholder />,
});

const VideoPlayer = dynamic(() => import("@/components/lesson/VideoPlayer"), {
  ssr: false,
  loading: () => <div className="player player-skeleton" aria-busy="true" aria-label="Loading video" />,
});

export default function StudentPlayer({
  lesson,
  initialAccess,
  overrideLocks = false,
}: {
  lesson: StudentLesson;
  initialAccess?: AccessResult;
  overrideLocks?: boolean;
}) {
  const { user, setLessonCompleted, setSubmission, outline, completed: completedMap, submissions } = useStudentSession();
  const { basePath } = useCoursePreview();
  const [completed, setCompleted] = useState(() => Boolean(completedMap[lesson.id]));
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    completedRef.current = completed;
  }, [completed]);

  useEffect(() => {
    setCompleted(Boolean(completedMap[lesson.id]));
    let cancelled = false;

    const load = async () => {
      const result = await fetchLessonProgress(lesson.id);
      if (cancelled) return;
      setCompleted(result.progress.completed);
      setNotes(result.progress.notes);
    };

    void load();
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

  const completeSurveyLesson = async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    setCompleted(true);
    setLessonCompleted(lesson.id, true);
    await persist({ completed: true, notes }, true);
  };

  const onNotesChange = (value: string) => {
    setNotes(value);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(() => {
      persist({ completed: completedRef.current, notes: value }, true);
    }, 700);
  };

  const ordered = splitCoursePhases(outline || []).flatMap((phase) => phase.chapters || []);
  const catalog = useMemo(() => catalogFromOutline(outline), [outline]);
  const liveAccess = checkLessonAccess(outlineToGate(lesson), catalog, submissions || {}, { completed: completedMap || {} });
  const access = catalog.length ? liveAccess : initialAccess || liveAccess;
  const chapterLocked =
    Boolean(lesson.chapterId) &&
    (outline || []).length > 0 &&
    isChapterSequentiallyLocked(outline || [], lesson.chapterId, completedMap || {});
  const resume = findResumeLesson(ordered, completedMap);
  const showSubmission = lesson.requires_submission === true || lesson.requires_coach_approval === true;
  const kind = displayLessonType(lesson);

  if (!overrideLocks && access.isLocked) {
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

  if (!overrideLocks && chapterLocked && resume && resume.lesson.id !== lesson.id) {
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
      {kind === "video" ? <VideoPlayer lesson={lesson} /> : null}

      <article className="lesson-body">
        {lesson.banner_image_url ? (
          <div className="lesson-header-banner">
            <img src={lesson.banner_image_url} alt="" />
          </div>
        ) : null}
        <p className="kicker">
          <LessonTypeIcon type={kind} title={lesson.title} size={13} />
          {lessonTypeLabel(kind)}
          {lesson.is_assignment ? <span className="badge assignment-flag">Assignment</span> : null}
        </p>
        <h1>{lesson.title}</h1>
        {status ? <p className="notice">{status}</p> : null}
        {kind === "survey" ? (
          <>
            {lesson.blurb ? <p className="lead">{lesson.blurb}</p> : null}
            <StudentSurveyForm
              embedded
              hideTitle
              allowInactive
              lessonId={lesson.id}
              surveyId={lesson.survey_id}
              slug={lesson.survey_slug || undefined}
              onSubmitted={() => {
                void completeSurveyLesson();
              }}
              nextHref={lesson.next ? `${basePath}/${lesson.next.id}` : null}
              nextTitle={lesson.next?.title || null}
            />
          </>
        ) : (
          <>
            {kind === "reading" ? (
              <div className="reading-hero">
                <span>{lesson.duration}</span>
                <p>{lesson.blurb}</p>
              </div>
            ) : lesson.blurb ? (
              <p className="lead">{lesson.blurb}</p>
            ) : null}
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

            <LessonPdfViewer pdfUrl={lesson.pdf_url} lesson={lesson} />

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
          </>
        )}
      </article>
    </>
  );
}
