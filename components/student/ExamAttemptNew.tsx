"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FIRST_BMCR_WORKSHEET_PAPER_ID, hasPrintableBmcrWorksheet } from "@/lib/bmcr-worksheet";
import { useCoursePreview } from "@/lib/course-preview";
import { createExamAttempt } from "@/lib/exam-attempts";
import { officialSourceSpec } from "@/lib/exam-source-pack";
import { PAST_PAPER_SITTINGS } from "@/lib/past-papers";
import { isCoachAccount } from "@/lib/roles";
import { hasTask1Submission, task1LessonHref } from "@/lib/task1-gate";
import { useStudentSession } from "@/lib/student-session";

export default function ExamAttemptNew() {
  const router = useRouter();
  const { ready, user, outline, submissions } = useStudentSession();
  const { unlocked } = useCoursePreview();
  const canUse = hasTask1Submission(submissions, outline) || unlocked || isCoachAccount(user);
  const [sittingId, setSittingId] = useState("jan-2026");
  const [paperId, setPaperId] = useState(FIRST_BMCR_WORKSHEET_PAPER_ID);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sitting = useMemo(
    () => PAST_PAPER_SITTINGS.find((item) => item.id === sittingId) || PAST_PAPER_SITTINGS[0],
    [sittingId]
  );
  const papers = sitting?.papers || [];
  const selectedPaper = papers.find((paper) => paper.id === paperId) || papers[0];
  const worksheetReady = hasPrintableBmcrWorksheet(selectedPaper?.id);
  const sourcesKnown = selectedPaper ? Boolean(officialSourceSpec(sitting.id, selectedPaper.id)) : false;

  function changeSitting(nextId: string) {
    setSittingId(nextId);
    const next = PAST_PAPER_SITTINGS.find((item) => item.id === nextId);
    setPaperId(next?.papers[0]?.id || "");
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
      <h1>Choose the sitting and paper first</h1>
      <p>
        This selection is the official identity of the attempt. We do not infer the exam from your handwriting. Download
        the BMCR worksheet and upload files only after you have chosen the paper you actually wrote.
      </p>

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

      <label className="eval-exam-picker">
        Paper
        <select className="select-line" value={selectedPaper?.id || ""} onChange={(event) => setPaperId(event.target.value)}>
          {papers.map((paper) => (
            <option key={paper.id} value={paper.id}>
              {paper.title} ({paper.total_marks} marks)
            </option>
          ))}
        </select>
      </label>

      {sitting.id === "jan-2026" ? (
        <p className="muted small">
          January 2026 is the first complete vertical slice: printable BMCR totals and official question, solution, and
          examiner commentary.
        </p>
      ) : null}
      {!worksheetReady ? (
        <p className="notice">A printable BMCR worksheet is not ready for this paper yet. Prefer January 2026.</p>
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
          {busy ? "Starting…" : "Continue to worksheet and uploads"}
        </button>
      </p>
    </article>
  );
}
