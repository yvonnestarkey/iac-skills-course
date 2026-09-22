"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { attemptDisplayTitle, attemptStatusLabel, fetchExamAttempt, type ExamAttempt } from "@/lib/exam-attempts";
import { useStudentSession } from "@/lib/student-session";

export default function ExamAttemptSubmitted() {
  const params = useParams<{ id: string }>();
  const { user } = useStudentSession();
  const attemptId = String(params.id || "");
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);

  useEffect(() => {
    if (!user?.id || !attemptId) return;
    fetchExamAttempt(user.id, attemptId).then((result) => {
      if (result.ok && result.attempt) setAttempt(result.attempt);
    });
    void fetch(`/api/exam-attempts/${attemptId}/prepare-evidence`, { method: "POST" });
  }, [user?.id, attemptId]);

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Exam attempt submitted</p>
      <h1>Your script is in!</h1>
      {attempt ? (
        <p className="muted">
          {attemptDisplayTitle(attempt)} · {attemptStatusLabel(attempt.status)}
        </p>
      ) : null}
      <p>
        We&apos;re analysing your BMCR, exam script and marking report alongside the exam question, official solution
        and examiner information.
      </p>
      <p>
        Your report will be available once the analysis is complete.
      </p>
      <p>
        You don&apos;t need to wait here. You can return to the course and keep working.
      </p>
      <p>
        Written IAC before? If you have another script from a previous sitting, you can submit that too. Use that
        sitting&apos;s BMCR. Each paper is a separate attempt. Once you&apos;ve submitted more than one script,
        we&apos;ll also be able to look for patterns across your attempts.
      </p>
      <div className="eval-confirm-actions">
        <Link className="primary" href="/student/dashboard">
          Return to course
        </Link>
        <Link className="eval-secondary" href="/student/evaluator/new">
          Upload another exam attempt
        </Link>
      </div>
    </article>
  );
}
