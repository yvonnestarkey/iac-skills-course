"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import { isCoachAccount } from "@/lib/roles";
import { hasTask2Submission, task2AssignmentFromOutline, task2LessonHref } from "@/lib/task2-gate";
import { useStudentSession } from "@/lib/student-session";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

export function useReadingToolAccess() {
  const { ready, user, submissions, entitlement } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { unlocked } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const staff = isCoachAccount(user);
  const task2 = task2AssignmentFromOutline(outline);
  const unlockedByTask2 = hasTask2Submission(submissions, outline);
  const bypass = unlocked || bypassLocks || staff;
  const canUse = (entitlement !== "none" && unlockedByTask2) || bypass;
  return { ready, canUse, task2, unlockedByTask2, bypass, outline };
}

export default function ReadingToolGate({ children }: { children: ReactNode }) {
  const { ready, canUse, task2, outline } = useReadingToolAccess();

  if (!ready) {
    return (
      <article className="lesson-body wide rd-page">
        <p className="muted">Loading Reading & RTFQ Tool…</p>
      </article>
    );
  }

  if (!canUse) {
    return (
      <article className="lesson-body wide rd-page">
        <p>
          <Link href="/student/dashboard">← Student dashboard</Link>
        </p>
        <p className="kicker">Reading & RTFQ Tool</p>
        <h1>Locked until Task 2 is submitted</h1>
        <p>
          You first work through the reading and RTFQ lessons in Task 2. After you submit that assignment, this hub
          opens so you can practice more of the same kind of question.
        </p>
        <p className="notice">
          Submit <strong>{task2.lessonTitle}</strong> to unlock extra practice.
        </p>
        <p>
          <Link className="primary" href={task2LessonHref(outline)}>
            Go to Task 2
          </Link>
        </p>
      </article>
    );
  }

  return <>{children}</>;
}
