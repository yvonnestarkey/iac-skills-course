"use client";

import Link from "next/link";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import { isCoachAccount } from "@/lib/roles";
import {
  findTask2ReadingLessons,
  hasTask2Submission,
  task2MopaneResult,
  task2ReadingCheckResult,
} from "@/lib/task2-gate";
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

export default function StudentReadingPractice() {
  const { user, submissions, readingAttempts, readingChecks } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { unlocked } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const coach = isCoachAccount(user);
  const readingUnlocked = hasTask2Submission(submissions, outline) || unlocked || bypassLocks || coach;
  const lessons = findTask2ReadingLessons(outline);
  const check = task2ReadingCheckResult(readingChecks);
  const mopane = task2MopaneResult(readingAttempts);
  const checkTitle = lessons.check?.title || "Reading check (Skimming)";
  const mopaneTitle = lessons.mopane?.title || "Mopane";
  const checkHref = lessons.check ? `/student/${lessons.check.id}` : "/student/reading/check";
  const mopaneHref = lessons.mopane ? `/student/${lessons.mopane.id}` : "/student/reading/mopane";

  const rows = [
    {
      id: "check",
      title: checkTitle,
      href: checkHref,
      done: Boolean(check),
      detail: check ? `${check.profile} · ${check.wpm} wpm` : "To do in Task 2",
    },
    {
      id: "mopane",
      title: mopaneTitle,
      href: mopaneHref,
      done: Boolean(mopane),
      detail: mopane ? `${Math.round(Number(mopane.grade?.pct || 0))}%` : "To do in Task 2",
    },
  ];

  return (
    <section className="student-reading-practice">
      <div className="student-reading-practice-art">
        <div className="student-reading-practice-top">
          <div>
            <p className="kicker">Reading</p>
            <h2>Reading &amp; RTFQ Tool</h2>
          </div>
          {readingUnlocked ? (
            <Link className="student-reading-practice-btn" href="/student/reading">
              Practice another one
            </Link>
          ) : null}
        </div>

        <ul className="student-task-date-list">
          {rows.map((row) => (
            <li key={row.id} className={row.done ? "is-complete" : undefined}>
              <div className="student-task-date-row">
                <span className="student-task-date-label">
                  {readingUnlocked || row.done ? <Link href={row.href}>{row.title}</Link> : row.title}
                  {row.done ? <CompleteStamp /> : null}
                </span>
                <span className={`student-task-date-value${row.done ? " is-submitted" : ""}`}>{row.detail}</span>
              </div>
            </li>
          ))}
          {readingUnlocked ? null : (
            <li>
              <p className="muted small">Unlocks after Task 2</p>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}
