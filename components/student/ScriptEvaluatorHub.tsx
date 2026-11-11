"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import {
  attemptCardStatus,
  attemptDisplayTitle,
  attemptIsWholeSitting,
  attemptStudentLabel,
  fetchAttemptStudentLabels,
  fetchEvaluatorAttempts,
  isAttemptSubmitted,
  type AttemptStudentLabel,
  type ExamAttempt,
} from "@/lib/exam-attempts";
import { isCoachAccount } from "@/lib/roles";
import { canOpenScriptEvaluator } from "@/lib/script-evaluator-access";
import { s4GateHref } from "@/lib/s4-repeat-gate";
import { task1AssignmentFromOutline, task1LessonHref } from "@/lib/task1-gate";
import { useStudentSession } from "@/lib/student-session";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

export default function ScriptEvaluatorHub() {
  const { ready, user, submissions, surveyReviews, entitlement } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { unlocked } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const staff = isCoachAccount(user);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [studentLabels, setStudentLabels] = useState<Record<string, AttemptStudentLabel>>({});
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const task1 = task1AssignmentFromOutline(outline);
  const unlockedByPrereq = canOpenScriptEvaluator({ submissions, outline, surveyReviews });
  const bypass = unlocked || bypassLocks;
  const canUse = (entitlement !== "none" && unlockedByPrereq) || bypass;

  useEffect(() => {
    if (!user?.id || !canUse) return;
    let cancelled = false;
    fetchEvaluatorAttempts({ userId: user.id, staff }).then(async (result) => {
      if (cancelled) return;
      if (result.ok === false) {
        setLoadError(result.error);
        setAttempts([]);
        setStudentLabels({});
        setLoaded(true);
        return;
      }
      setLoadError("");
      setAttempts(result.attempts);
      const labels = await fetchAttemptStudentLabels(result.attempts.map((attempt) => attempt.user_id));
      if (!cancelled) setStudentLabels(labels);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, staff, canUse]);

  if (!ready) {
    return (
      <article className="lesson-body wide eval-page">
        <p className="muted">Loading script evaluator…</p>
      </article>
    );
  }

  if (!canUse) {
    return (
      <article className="lesson-body wide eval-page">
        <p>
          <Link href="/student/dashboard">← Student dashboard</Link>
        </p>
        <p className="kicker">Script evaluator</p>
        <h1>Locked until you know BMCR</h1>
        <p>
          Script evaluation needs BMCR. Task 1 teaches that. If you have done this course with Yvonne before, you already
          know it — answer the S4 question, or submit Grassroots, and this tool opens.
        </p>
        <p className="notice">
          First time here? Submit <strong>{task1.lessonTitle}</strong>. Returning student? Say yes on the S4 question.
        </p>
        <p className="coaching-actions">
          <Link className="primary" href={task1LessonHref(outline)}>
            Go to Task 1
          </Link>
          <Link className="ghost" href={s4GateHref(outline)}>
            I&apos;ve done this course before
          </Link>
        </p>
      </article>
    );
  }

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/dashboard">← Student dashboard</Link>
      </p>
      <p className="kicker">Script evaluator</p>
      <h1>Submit an exam attempt</h1>
      <p>
        Choose a sitting, print one BMCR for all three papers, then upload that worksheet with Paper 1, Paper 2, Paper 3,
        and the marking report on one attempt.
      </p>
      <p className="muted small">
        Each attempt stays separate. If you have written IAC more than once, submit each sitting on its own.
      </p>
      {bypass && !unlockedByPrereq ? (
        <p className="notice">Coach view: Task 1 / Grassroots / S4 yes is not required on this account.</p>
      ) : null}

      <p>
        <Link className="primary" href="/student/evaluator/new">
          Start an exam attempt
        </Link>
      </p>

      <section className="eval-attempts" aria-labelledby="my-exam-attempts">
        <h2 id="my-exam-attempts">{staff ? "Exam attempts" : "My exam attempts"}</h2>
        {loadError ? <p className="notice">{loadError}</p> : null}
        {loaded && !attempts.length && !loadError ? (
          <p className="muted">No exam attempts yet. Start with one sitting.</p>
        ) : null}
        {attempts.length ? (
          <ul className="eval-attempt-list">
            {attempts.map((attempt) => {
              const href = isAttemptSubmitted(attempt.status)
                ? `/student/evaluator/attempt/${attempt.id}/submitted`
                : `/student/evaluator/attempt/${attempt.id}`;
              const student = studentLabels[attempt.user_id] || attemptStudentLabel(attempt);
              return (
                <li key={attempt.id}>
                  <Link href={href} className="eval-attempt-card">
                    <strong className="eval-attempt-student">{student.name}</strong>
                    <span className={`pill${attempt.evaluator_report_released_at ? " is-ready" : ""}`}>{attemptCardStatus(attempt)}</span>
                    <p className="eval-attempt-paper">{attemptDisplayTitle(attempt)}</p>
                    {attempt.evaluator_report_released_at ? (
                      <p className="eval-attempt-report">Your report is ready: open it to view or download it.</p>
                    ) : null}
                    <p className="muted small">
                      {student.email || ""}
                      {!attemptIsWholeSitting(attempt) && attempt.paper_code ? `${student.email ? " · " : ""}${attempt.paper_code}` : ""}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </section>

      <details className="eval-legacy">
        <summary>Previous diagnostic tools</summary>
        <p className="muted small">
          These are no longer the Script Evaluator path. Existing BMCR, Volume vs Accuracy, Buried Treasure, and older
          mark-report evaluations are still here.
        </p>
        <p>
          <Link href="/student/bmcr">Online BMCR calculator</Link>
          {" · "}
          <Link href="/student/volume-accuracy">Volume vs Accuracy</Link>
          {" · "}
          <Link href="/student/buried-treasure">Buried Treasure</Link>
          {" · "}
          <Link href="/student/evaluator/report">Previous AI mark report</Link>
        </p>
      </details>
    </article>
  );
}
