"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import {
  evaluatorContinueHref,
  hasPrintableBmcrWorksheet,
  resolveBmcrSittingId,
  worksheetHref,
} from "@/lib/bmcr-worksheet";
import { useBypassLessonLocks, useCoursePreview } from "@/lib/course-preview";
import { createExamAttempt } from "@/lib/exam-attempts";
import { officialSourceSpec } from "@/lib/exam-source-pack";
import { DEFAULT_PAST_PAPER_SITTING_ID, PAST_PAPER_SITTINGS } from "@/lib/past-papers";
import { isEvaluatorReadySitting } from "@/lib/evaluator/ready-sittings";

/** Only sittings the Script Evaluator has been set up for are offered (Yvonne, 20 Oct 2026). */
const EVALUATOR_SITTINGS = PAST_PAPER_SITTINGS.filter((item) => isEvaluatorReadySitting(item.id));
import { hasTask1Submission, task1LessonHref } from "@/lib/task1-gate";
import { useStudentSession } from "@/lib/student-session";

export default function ExamAttemptNew() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready, user, outline, submissions } = useStudentSession();
  const { unlocked } = useCoursePreview();
  const bypassLocks = useBypassLessonLocks();
  const canUse = hasTask1Submission(submissions, outline) || unlocked || bypassLocks;
  const [sittingId, setSittingId] = useState(
    () => {
      const requested = resolveBmcrSittingId(searchParams.get("sitting"));
      return requested && isEvaluatorReadySitting(requested) ? requested : DEFAULT_PAST_PAPER_SITTING_ID;
    }
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sitting = useMemo(
    () => EVALUATOR_SITTINGS.find((item) => item.id === sittingId) || EVALUATOR_SITTINGS[0] || PAST_PAPER_SITTINGS[0],
    [sittingId]
  );
  const papers = sitting?.papers || [];
  const worksheetReady = hasPrintableBmcrWorksheet(sitting.id);
  const officialSpec = papers[0] ? officialSourceSpec(sitting.id, papers[0].id) : null;
  const sourcesKnown = Boolean(officialSpec);
  const commentaryKnown = Boolean(officialSpec?.commentary.length);
  const returnTo = evaluatorContinueHref(`/student/evaluator/new?sitting=${sitting.id}`, sitting.id);

  function changeSitting(nextId: string) {
    setSittingId(nextId);
    router.replace(`/student/evaluator/new?sitting=${encodeURIComponent(nextId)}`, { scroll: false });
  }

  async function startAttempt() {
    if (!user?.id || !sitting) return;
    setBusy(true);
    setError("");
    const created = await createExamAttempt({
      userId: user.id,
      sittingId: sitting.id,
    });
    setBusy(false);
    if (created.ok === false) {
      setError(created.error);
      return;
    }
    router.push(`/student/evaluator/attempt/${created.attempt.id}`);
  }

  if (!ready) {
    return (
      <article className="lesson-body wide eval-page">
        <p className="muted">Loading…</p>
      </article>
    );
  }

  if (!canUse) {
    return (
      <article className="lesson-body wide eval-page">
        <p>
          <Link href="/student/evaluator">← Script evaluator</Link>
        </p>
        <p className="notice">Submit Task 1 first. The Script Evaluator stays locked until that assignment is in.</p>
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
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">New exam attempt</p>
      <h1>Sitting, then BMCR, then all three papers</h1>
      <p>
        Print one BMCR for the whole sitting. Then upload Paper 1, Paper 2 and Paper 3 together on the next screen,
        with that same worksheet and the marking report.
      </p>

      <ol className="eval-flow">
        <li className="eval-flow-step">
          <h2>1. Choose the exam sitting</h2>
          <label className="eval-exam-picker">
            Sitting
            <select className="select-line" value={sitting.id} onChange={(event) => changeSitting(event.target.value)}>
              {EVALUATOR_SITTINGS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </li>

        <li className="eval-flow-step">
          <h2>2. Print one BMCR for this sitting</h2>
          <p>
            One worksheet covers Paper 1, Paper 2 and Paper 3. Fill it in by hand. You do not print a new BMCR for each
            paper.
          </p>
          <p className="muted small">
            On this sheet: {papers.map((paper) => paper.title).join(" · ") || "all papers in the sitting"}
          </p>
          {worksheetReady ? (
            <p>
              <Link className="primary" href={worksheetHref(sitting.id, returnTo)}>
                Print sitting BMCR
              </Link>
            </p>
          ) : (
            <p className="notice">A printable BMCR worksheet is not ready for this sitting yet. Prefer January 2026.</p>
          )}
        </li>

      </ol>

      {sitting.id === "june-2026" ? (
        <p className="muted small">
          June 2026 is the current calibration sitting: printable BMCR totals and official question and solution files.
          January 2026 remains a preserved historical calibration sitting.
        </p>
      ) : null}
      {sitting.id === "jan-2026" ? (
        <p className="muted small">
          January 2026 is preserved as a complete historical calibration sitting: printable BMCR totals and official
          question, solution, and examiner commentary.
        </p>
      ) : null}
      {sourcesKnown && !commentaryKnown ? (
        <p className="muted small">
          Examiner commentary is not mapped for this sitting. Official question, solution, and competency sources are
          mapped. Missing commentary does not block evidence readiness.
        </p>
      ) : null}
      {!sourcesKnown ? (
        <p className="notice">
          Official question / solution / examiner files are not mapped for this sitting yet. You can still store the
          attempt, but analysis sources will be incomplete.
        </p>
      ) : null}

      {error ? <p className="notice">{error}</p> : null}

      <p>
        <button type="button" className="primary" disabled={busy || !user?.id || !sitting} onClick={startAttempt}>
          {busy ? "Starting…" : "3. Continue to uploads"}
        </button>
      </p>
    </article>
  );
}
