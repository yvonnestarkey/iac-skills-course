"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import {
  attemptDisplayTitle,
  attemptStatusLabel,
  attemptStudentLabel,
  fetchAttemptStudentLabels,
  fetchEvaluatorAttempts,
  isAttemptSubmitted,
  type AttemptStudentLabel,
  type ExamAttempt,
} from "@/lib/exam-attempts";
import { isCoachAccount } from "@/lib/roles";
import { hasTask1Submission, task1AssignmentFromOutline, task1LessonHref } from "@/lib/task1-gate";
import { useStudentSession } from "@/lib/student-session";

export default function ScriptEvaluatorHub() {
  const { ready, user, outline, submissions } = useStudentSession();
  const { unlocked } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const staff = isCoachAccount(user);
  const [attempts, setAttempts] = useState<ExamAttempt[]>([]);
  const [studentLabels, setStudentLabels] = useState<Record<string, AttemptStudentLabel>>({});
  const [loadError, setLoadError] = useState("");
  const [loaded, setLoaded] = useState(false);

  const task1 = task1AssignmentFromOutline(outline);
  const unlockedByTask1 = hasTask1Submission(submissions, outline);
  const bypass = unlocked || bypassLocks;
  const canUse = unlockedByTask1 || bypass;

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
        <h1>Locked until Task 1 is submitted</h1>
        <p>
          Task 1 is the gate. You first evaluate your own performance with evidence, then the Script Evaluator opens so
          you can submit a script.
        </p>
        <p className="notice">
          Submit <strong>{task1.lessonTitle}</strong> to unlock this tool. BMCR, Volume vs Accuracy, and Buried Treasure
          are not required here.
        </p>
        <p>
          <Link className="primary" href={task1LessonHref(outline)}>
            Go to Task 1
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
        Choose a sitting, print one BMCR for all three papers, then submit each exam script as its own attempt with the
        completed worksheet, the script, and the marking report.
      </p>
      <p className="muted small">
        Each attempt stays separate. If you have written IAC more than once, submit each sitting on its own.
      </p>
      {bypass && !unlockedByTask1 ? (
        <p className="notice">Coach view: Task 1 submission is not required on this account.</p>
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
          <p className="muted">No exam attempts yet. Start with one sitting and paper.</p>
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
                    <span className="pill">{attemptStatusLabel(attempt.status)}</span>
                    <p className="eval-attempt-paper">{attemptDisplayTitle(attempt)}</p>
                    <p className="muted small">
                      {student.email ? `${student.email} · ` : ""}
                      {attempt.paper_code}
                    </p>
                    <p className="muted small eval-attempt-id">Attempt {attempt.id}</p>
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
