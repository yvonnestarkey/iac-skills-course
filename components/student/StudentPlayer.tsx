"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FilePenLine } from "lucide-react";
import CoachLessonEditor from "@/components/coach/CoachLessonEditor";
import { LessonPdfPlaceholder } from "@/components/student/LessonLoadingSkeleton";
import LessonTypeIcon from "@/components/lesson/LessonTypeIcon";
import StudentCoachThread from "@/components/student/StudentCoachThread";
import LessonSubmissionForm from "@/components/student/LessonSubmissionForm";
import StudentSurveyForm from "@/components/student/StudentSurveyForm";
import {
  fetchLessonProgress,
  logLessonOpened,
  saveLessonProgress,
  saveVideoWatchProgress,
  type StudentLesson,
} from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";
import { catalogFromOutline, checkLessonAccess, outlineToGate, type AccessResult } from "@/lib/accessControl";
import { composeLessonAvailability } from "@/lib/lesson-availability";
import { findResumeLesson, isChapterSequentiallyLocked, splitCoursePhases } from "@/lib/course-phases";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import { displayLessonType, lessonTypeLabel } from "@/lib/lesson-type";
import LessonCarryForwardCheckpoint from "@/components/lesson/LessonCarryForwardCheckpoint";
import LessonVideoParts from "@/components/lesson/LessonVideoParts";
import LessonTool from "@/components/reading/LessonTool";
import { isProgressiveCheckpoint } from "@/lib/lesson-checkpoint";
import { isMultiVideoLesson, parseLessonVideos } from "@/lib/lesson-videos";
import LinkedText from "@/components/ui/LinkedText";
import { firstLessonWebLink } from "@/lib/getLessonPdf";
import { requestDripCatchup } from "@/lib/drip-messages";
import { readingHeroDuration } from "@/lib/lesson-duration";
import { isCoachAccount } from "@/lib/roles";
import { resolveCourseHref } from "@/lib/rich-text";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

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
  const { user, setLessonCompleted, setSubmission, completed: completedMap, submissions, entitlement, previewLessonIds } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { basePath } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const skipLocks = overrideLocks || bypassLocks;
  const canEditLesson = isCoachAccount(user) && skipLocks;
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
    if (user && !isCoachAccount(user)) void logLessonOpened(lesson.id);
    return () => {
      cancelled = true;
      if (notesTimer.current) clearTimeout(notesTimer.current);
    };
  }, [completedMap, lesson.id, user]);

  const onWatchProgress = useCallback(
    (seconds: number, percent: number) => {
      if (!user || isCoachAccount(user)) return;
      void saveVideoWatchProgress(lesson.id, seconds, percent).then((result) => {
        if (result.completed && !completedRef.current) {
          completedRef.current = true;
          setCompleted(true);
          setLessonCompleted(lesson.id, true);
          void requestDripCatchup();
        }
      });
    },
    [lesson.id, setLessonCompleted, user]
  );

  const persist = async (next: { completed: boolean; notes: string }, silent = false) => {
    const result = await saveLessonProgress(lesson.id, next);
    if (result.ok) {
      setLessonCompleted(lesson.id, next.completed);
      if (next.completed) void requestDripCatchup();
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
  const gatedTarget = catalog.find((item) => item.id === lesson.id) || outlineToGate(lesson);
  const liveAccess = checkLessonAccess(gatedTarget, catalog, submissions || {}, { completed: completedMap || {} });
  const chapterLocked =
    Boolean(lesson.chapterId) &&
    (outline || []).length > 0 &&
    isChapterSequentiallyLocked(outline || [], lesson.chapterId, completedMap || {});
  const pedagogical =
    chapterLocked && !previewLessonIds.includes(lesson.id)
      ? { isLocked: true, reason: "Finish the previous section first." }
      : catalog.length
        ? liveAccess
        : initialAccess || liveAccess;
  const composed = composeLessonAvailability({
    commercialCanRead:
      skipLocks ||
      (entitlement !== "none" &&
        (entitlement === "full" || entitlement === "staff" || previewLessonIds.includes(lesson.id))),
    isPreviewLesson: previewLessonIds.includes(lesson.id),
    pedagogical,
  });
  const access = composed.access;
  const resume = findResumeLesson(ordered, completedMap);
  const resourceLink = firstLessonWebLink(lesson);
  const resourceHref = resourceLink ? resolveCourseHref(resourceLink.url) : null;
  const showSubmission = lesson.requires_submission === true || lesson.requires_coach_approval === true;
  const kind = displayLessonType(lesson);
  const isAssignmentPage = showSubmission || Boolean(lesson.is_assignment) || kind === "assignment" || kind === "upload";
  const videos = lesson.videos?.length ? lesson.videos : parseLessonVideos(lesson.video_url);
  const isMultiVideo = isMultiVideoLesson(kind, videos);
  const isCheckpoint = isProgressiveCheckpoint({ ...lesson, videos });
  const purchaseLocked = !skipLocks && composed.layer === "purchase";

  if (purchaseLocked) {
    return (
      <article className="lesson-body">
        <p className="kicker">Full course lesson</p>
        <h1>{lesson.title}</h1>
        <p className="lead">{lesson.locked_message || "This lesson is part of the full Jan 2027 IAC course."}</p>
        <div className="actions">
          <Link className="primary" href="/checkout">
            Buy full course
          </Link>
          <Link className="ghost" href="/student/dashboard">
            Back to preview
          </Link>
        </div>
      </article>
    );
  }

  if (!skipLocks && access.isLocked) {
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

  if (!skipLocks && composed.layer !== "preview" && chapterLocked && resume && resume.lesson.id !== lesson.id) {
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
      {kind === "video" && !isMultiVideo && !isCheckpoint ? (
        <VideoPlayer lesson={lesson} src={videos[0]?.url} onWatchProgress={onWatchProgress} />
      ) : null}

      <article className="lesson-body">
        {lesson.is_draft ? (
          <p className="lesson-draft-mark" role="status">
            <FilePenLine size={18} aria-hidden="true" />
            Draft
          </p>
        ) : null}
        {canEditLesson ? <CoachLessonEditor lesson={lesson} /> : null}
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
            {lesson.blurb ? (
              <p className="lead">
                <LinkedText text={lesson.blurb} />
              </p>
            ) : null}
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
            {kind === "reading" && !isCheckpoint ? (
              <div className="reading-hero">
                {readingHeroDuration(lesson.duration) ? <span>{readingHeroDuration(lesson.duration)}</span> : null}
                {lesson.blurb ? (
                  <p>
                    <LinkedText text={lesson.blurb} />
                  </p>
                ) : null}
              </div>
            ) : !isCheckpoint && lesson.blurb ? (
              <p className="lead">
                <LinkedText text={lesson.blurb} />
              </p>
            ) : null}
            {isCheckpoint ? (
              <>
                <LessonCarryForwardCheckpoint
                  lesson={lesson}
                  video={videos[0]}
                  notes={notes}
                  onProgress={(next) => {
                    setNotes(next.notes);
                    setCompleted(next.completed);
                    setLessonCompleted(lesson.id, next.completed);
                  }}
                  onWatchProgress={onWatchProgress}
                />
                {completed && lesson.next ? (
                  <div className="actions">
                    <Link className="primary" href={`${basePath}/${lesson.next.id}`}>
                      Next: {lesson.next.title} →
                    </Link>
                  </div>
                ) : null}
              </>
            ) : (
              <>
            {lesson.due ? <p className="lead">Due {lesson.due}</p> : null}
            {lesson.brief ? (
              <p>
                <LinkedText text={lesson.brief} />
              </p>
            ) : null}
            {(lesson.body || []).map((paragraph, index) => (
              <p key={`${lesson.id}-body-${index}`}>
                <LinkedText text={paragraph} />
              </p>
            ))}
            {isMultiVideo ? <LessonVideoParts lesson={lesson} videos={videos} onWatchProgress={onWatchProgress} /> : null}
            {(lesson.takeaways || []).length ? (
              <div className="takeaways">
                <h3>Takeaways</h3>
                <ul>
                  {lesson.takeaways!.map((item) => (
                    <li key={item}>
                      <LinkedText text={item} />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {lesson.tool && lesson.tool !== "variance-bakery" ? (
              <LessonTool tool={lesson.tool} onComplete={completeSurveyLesson} />
            ) : null}

            {resourceLink && resourceHref ? (
              <a className="primary lesson-resource-link" href={resourceHref} target="_blank" rel="noopener noreferrer">
                {resourceLink.title}
              </a>
            ) : null}
            <LessonPdfViewer pdfUrl={lesson.pdf_url} lesson={lesson} />

            {isAssignmentPage ? null : (
              <>
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
              </>
            )}
            {isAssignmentPage && user ? (
              <LessonSubmissionForm
                lessonId={lesson.id}
                studentId={user.id}
                requiresCoachApproval={Boolean(lesson.requires_coach_approval)}
                practiceOnly={!showSubmission}
                saved={submissions[lesson.id]}
                onSaved={(submission) => {
                  if (submission) setSubmission(lesson.id, submission);
                  setCompleted(true);
                  setLessonCompleted(lesson.id, true);
                  persist({ completed: true, notes }, true);
                }}
              />
            ) : null}
            {isAssignmentPage ? (
              <div className="actions">
                {lesson.next ? (
                  <Link className="primary" href={`${basePath}/${lesson.next.id}`}>
                    Next: {lesson.next.title} →
                  </Link>
                ) : (
                  <Link className="ghost" href={`${basePath}/dashboard`}>
                    Back to dashboard
                  </Link>
                )}
              </div>
            ) : lesson.type === "ask" ? (
              <StudentCoachThread
                compact
                title="Ask the Coach"
                context={`${lesson.chapterTitle} · ${lesson.title}`}
                lessonId={lesson.id}
              />
            ) : null}
              </>
            )}
          </>
        )}
      </article>
    </>
  );
}
