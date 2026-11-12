"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCoursePreview } from "@/lib/course-preview";
import { hasCoachReview, surveyReviewSummary } from "@/lib/custom-surveys";
import { hasWrittenFeedback } from "@/lib/feedback-log";
import { S4_REPEAT_GATE_LESSON_ID } from "@/lib/s4-repeat-gate";
import { useStudentSession } from "@/lib/student-session";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

function CompleteStamp() {
  return (
    <span className="task-complete-mark">
      <span className="task-complete-tick" aria-hidden="true">
        ✓
      </span>
      <span className="task-complete-stamp">completed!</span>
    </span>
  );
}

export default function StudentAssignmentFeedback() {
  const { submissions, surveyReviews } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { basePath } = useCoursePreview();

  const rows = useMemo(() => {
    const surveyLessons = new Map<string, { id: string; title: string; surveyId: string }>();
    const lessonTitles = new Map<string, string>();
    (outline || []).forEach((chapter) => {
      (chapter.lessons || []).forEach((lesson) => {
        lessonTitles.set(lesson.id, lesson.title);
        if (lesson.survey_id) surveyLessons.set(lesson.survey_id, { id: lesson.id, title: lesson.title, surveyId: lesson.survey_id });
      });
    });

    const items: { id: string; title: string; href: string; done: boolean; detail: string }[] = [];

    Object.entries(surveyReviews || {}).forEach(([surveyId, response]) => {
      const lesson = surveyLessons.get(surveyId);
      if (lesson?.id === S4_REPEAT_GATE_LESSON_ID) return;
      const done = hasCoachReview({
        ...response,
        feedback: response.feedback || "",
        feedbackFileUrl: response.feedbackFileUrl || "",
      });
      items.push({
        id: `survey-${surveyId}`,
        title: lesson?.title || "Submitted work",
        href: lesson ? `${basePath}/${lesson.id}` : "/student/feedback",
        done,
        detail: done ? surveyReviewSummary(response) : "Awaiting review",
      });
    });

    Object.values(submissions || {}).forEach((item) => {
      if (surveyLessons.has(item.lesson_id) || item.lesson_id === S4_REPEAT_GATE_LESSON_ID) return;
      const done = item.status === "approved" || item.status === "rejected" || hasWrittenFeedback(item.feedback);
      items.push({
        id: `lesson-${item.lesson_id}`,
        title: lessonTitles.get(item.lesson_id) || "Lesson submission",
        href: `${basePath}/${item.lesson_id}`,
        done,
        detail: item.status === "approved" ? "Approved" : item.status === "rejected" ? "Rejected" : done ? "Feedback in" : "Submitted",
      });
    });

    return items.slice(0, 6);
  }, [basePath, outline, submissions, surveyReviews]);

  return (
    <section className="student-assignment-feedback">
      <div className="student-assignment-feedback-art">
        <div className="student-assignment-feedback-top">
          <div>
            <p className="kicker">Feedback</p>
            <h2>Assignment feedback</h2>
          </div>
          <Link className="student-reading-practice-btn" href="/student/feedback">
            View all
          </Link>
        </div>
        <ul className="student-task-date-list">
          {rows.length ? (
            rows.map((row) => (
              <li key={row.id} className={row.done ? "is-complete" : undefined}>
                <div className="student-task-date-row">
                  <span className="student-task-date-label">
                    <Link href={row.href}>{row.title}</Link>
                    {row.done ? <CompleteStamp /> : null}
                  </span>
                  <span className={`student-task-date-value${row.done ? " is-submitted" : ""}`}>{row.detail}</span>
                </div>
              </li>
            ))
          ) : (
            <li>
              <p className="muted small">When you submit a survey or assignment, coach comments will show up here.</p>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
