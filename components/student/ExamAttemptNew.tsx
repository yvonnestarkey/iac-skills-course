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
import { PAST_PAPER_SITTINGS } from "@/lib/past-papers";
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
    () => resolveBmcrSittingId(searchParams.get("sitting")) || "jan-2026"
  );
  const [paperId, setPaperId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sitting = useMemo(
    () => PAST_PAPER_SITTINGS.find((item) => item.id === sittingId) || PAST_PAPER_SITTINGS[0],
    [sittingId]
  );
  const papers = sitting?.papers || [];
  const selectedPaper = papers.find((paper) => paper.id === paperId) || papers[0];
  const worksheetReady = hasPrintableBmcrWorksheet(sitting.id);
  const sourcesKnown = selectedPaper ? Boolean(officialSourceSpec(sitting.id, selectedPaper.id)) : false;
  const returnTo = evaluatorContinueHref(`/student/evaluator/new?sitting=${sitting.id}`, sitting.id);

  function changeSitting(nextId: string) {
    setSittingId(nextId);
    const next = PAST_PAPER_SITTINGS.find((item) => item.id === nextId);
    setPaperId(next?.papers[0]?.id || "");
    router.replace(`/student/evaluator/new?sitting=${encodeURIComponent(nextId)}`, { scroll: false });
  }

  async function startAttempt() {
    if (!user?.id || !sitting || !selectedPaper) return;
    setBusy(true);
    setError("");
    const created = await createExamAttempt({
      userId: user.id,
      sittingId: sitting.id,
      paperId: selectedPaper.id,
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
      <h1>Sitting, then BMCR, then one paper</h1>
      <p>
        Print one BMCR for the whole sitting. After that, choose which paper&apos;s script this attempt is for. You
        reuse the same worksheet for every paper from that sitting.
      </p>

      <ol className="eval-flow">
        <li className="eval-flow-step">
          <h2>1. Choose the exam sitting</h2>
          <label className="eval-exam-picker">
            Sitting
            <select className="select-line" value={sitting.id} onChange={(event) => changeSitting(event.target.value)}>
              {PAST_PAPER_SITTINGS.map((item) => (
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

        <li className="eval-flow-step">
          <h2>3. Which paper&apos;s script is this attempt?</h2>
          <p>
            This only chooses the script you are uploading now. It does not create another BMCR. Each paper stays a
            separate attempt.
          </p>
          <label className="eval-exam-picker">
            Paper
            <select
              className="select-line"
              value={selectedPaper?.id || ""}
              onChange={(event) => setPaperId(event.target.value)}
            >
              {papers.map((paper) => (
                <option key={paper.id} value={paper.id}>
                  {paper.title} ({paper.total_marks} marks)
                </option>
              ))}
            </select>
          </label>
        </li>
      </ol>

      {sitting.id === "jan-2026" ? (
        <p className="muted small">
          January 2026 is the first complete vertical slice: printable BMCR totals and official question, solution, and
          examiner commentary.
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
        <button type="button" className="primary" disabled={busy || !user?.id || !selectedPaper} onClick={startAttempt}>
          {busy ? "Starting…" : "4. Continue to uploads"}
        </button>
      </p>
    </article>
  );
}
