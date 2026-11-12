"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ActivityGrid from "@/components/coach/ActivityGrid";
import { activityColumnsFromOutline } from "@/lib/activity-grid";
import { findResumeLesson, splitCoursePhases } from "@/lib/course-phases";
import { completionProgress } from "@/lib/metrics";
import { engagementByLesson, emptyStudentProgress } from "@/lib/lesson-progress";
import { fetchOwnStudentProgress, submittedTaskCount } from "@/lib/study-journal";
import { taskDueItemsFromOutline } from "@/lib/student-task-due-dates";
import { useStudentSession } from "@/lib/student-session";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";
import type { Student } from "@/lib/types";

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
  const columns = useMemo(() => activityColumnsFromOutline(chapters), [chapters]);
  const byLesson = useMemo(() => engagementByLesson(engagement.lessons), [engagement.lessons]);
  const student = useMemo<Student | null>(
    () =>
      user
        ? {
            id: user.id,
            name: user.full_name?.trim() || user.email || "You",
            email: user.email || "",
            cohort: "jan27",
            status: "active",
          }
        : null,
    [user]
  );

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

  const submittedLabel = tasks.total
    ? `${tasks.done} of ${tasks.total} task${tasks.total === 1 ? "" : "s"} submitted`
    : `${progress.done} of ${progress.total} lessons complete`;

  return (
    <section className={`card study-journal-progress${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="activity-progress-toggle"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <div className="study-journal-progress-copy">
          <strong>Course progress</strong>
          <div className="progress-wide" aria-hidden="true">
            <span style={{ width: `${progress.pct}%` }} />
          </div>
          <span className="muted small">{submittedLabel}</span>
        </div>
        <span className="activity-progress-meta">
          <span className="score-chip small">{progress.pct}%</span>
          {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </span>
      </button>
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
          {student ? (
            <ActivityGrid
              columns={columns}
              rows={[{ student, byLesson }]}
              selectable={false}
              hideCoachColumns
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
