"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { completionProgress } from "@/lib/metrics";
import { fetchOwnStudentProgress, submittedTaskCount } from "@/lib/study-journal";
import { taskDueItemsFromOutline } from "@/lib/student-task-due-dates";
import { useStudentSession } from "@/lib/student-session";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";
import { emptyStudentProgress } from "@/lib/lesson-progress";

export default function StudentCourseProgress() {
  const { user, completed, submissions } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const [open, setOpen] = useState(false);
  const [engagement, setEngagement] = useState(emptyStudentProgress());

  const chapters = outline || [];
  const lessons = chapters.flatMap((chapter) => chapter.lessons || []);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const progress = completionProgress(
    Object.entries(completed || {})
      .filter(([, done]) => done)
      .map(([id]) => id),
    lessonIds
  );
  const tasks = submittedTaskCount(taskDueItemsFromOutline(outline), submissions || {});
  const ordered = splitCoursePhases(chapters).flatMap((phase) => phase.chapters || []);
  const resume = findResumeLesson(ordered, completed || {});
  const opened = useMemo(
    () => engagement.opened.filter((id) => !lessonIds.length || lessonIds.includes(id)).length,
    [engagement.opened, lessonIds]
  );
  const watched = engagement.lessons.filter((item) => item.reasons.includes("watched") && (!lessonIds.length || lessonIds.includes(item.lessonId))).length;
  const assignmentCount = Object.keys(submissions || {}).length;
  const notStarted = Math.max(0, progress.total - opened);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    fetchOwnStudentProgress(user.id).then((next) => {
      if (!cancelled) setEngagement(next);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return (
    <section className="card study-journal-progress">
      <button
        type="button"
        className="activity-progress-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div>
          <p className="kicker">Course progress</p>
          <h2>Your progress</h2>
          <p className="muted small">
            {tasks.total
              ? `${tasks.done} of ${tasks.total} task${tasks.total === 1 ? "" : "s"} submitted`
              : `${progress.done} of ${progress.total} lessons complete`}
          </p>
        </div>
        <span className="activity-progress-meta">
          <span className="score-chip">{progress.pct}%</span>
          {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
        </span>
      </button>
      <div className="progress-wide" aria-hidden="true">
        <span style={{ width: `${progress.pct}%` }} />
      </div>
      {open ? (
        <>
          <div className="progress-legend">
            <span>{progress.done} complete</span>
            <span>{opened} opened</span>
            <span>{watched} watched to 80%</span>
            <span>
              {assignmentCount} assignment submission{assignmentCount === 1 ? "" : "s"}
            </span>
            <span>{notStarted} not started</span>
          </div>
          <p className="activity-here">
            {resume?.lesson
              ? `Currently on ${[resume.chapter.title, resume.lesson.title].filter(Boolean).join(" · ")}.`
              : "No lesson activity recorded yet."}
          </p>
        </>
      ) : null}
    </section>
  );
}
