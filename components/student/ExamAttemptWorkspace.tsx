"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { worksheetHref } from "@/lib/bmcr-worksheet";
import {
  EXAM_ATTEMPT_FILE_LABELS,
  attemptDisplayTitle,
  attemptFileCount,
  attemptHasFile,
  fetchExamAttempt,
  isAttemptSubmitted,
  markAttemptAnalysing,
  uploadExamAttemptFile,
  type ExamAttempt,
  type ExamAttemptFileKind,
} from "@/lib/exam-attempts";
import { renderPdfPageImages } from "@/lib/pdf-page-images";
import { useStudentSession } from "@/lib/student-session";

const FILE_KINDS: ExamAttemptFileKind[] = ["bmcr_worksheet", "marked_script", "marking_report"];

const FILE_HELP: Record<ExamAttemptFileKind, string> = {
  bmcr_worksheet: "The completed sitting BMCR — one handwritten sheet covers all three papers.",
  marked_script: "The marked exam script you wrote in the venue, including workings and marker comments.",
  marking_report: "The official marking report / mark schedule for this attempt — not the script itself.",
};

export default function ExamAttemptWorkspace() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useStudentSession();
  const attemptId = String(params.id || "");
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [error, setError] = useState("");
  const [busyKind, setBusyKind] = useState<ExamAttemptFileKind | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user?.id || !attemptId) return;
    fetchExamAttempt(user.id, attemptId).then((result) => {
      if (result.ok === false) {
        setError(result.error);
        return;
      }
      if (!result.attempt) {
        setError("That exam attempt was not found.");
        return;
      }
      if (isAttemptSubmitted(result.attempt.status)) {
        router.replace(`/student/evaluator/attempt/${result.attempt.id}/submitted`);
        return;
      }
      setAttempt(result.attempt);
    });
  }, [user?.id, attemptId, router]);

  async function onUpload(kind: ExamAttemptFileKind, file: File | undefined) {
    if (!file || !user?.id || !attempt) return;
    setBusyKind(kind);
    setError("");
    let pageImages: { page: number; blob: Blob }[] = [];
    try {
      pageImages = await renderPdfPageImages(file);
    } catch {
      pageImages = [];
    }
    const uploaded = await uploadExamAttemptFile({
      userId: user.id,
      attemptId: attempt.id,
      kind,
      file,
      pageImages,
    });
    setBusyKind(null);
    if (uploaded.ok === false) {
      setError(uploaded.error);
      return;
    }
    setAttempt(uploaded.attempt);
  }

  async function onSubmit() {
    if (!user?.id || !attempt) return;
    setSubmitting(true);
    setError("");
    const marked = await markAttemptAnalysing(user.id, attempt.id);
    if (marked.ok === false) {
      setSubmitting(false);
      setError(marked.error);
      return;
    }
    void fetch(`/api/exam-attempts/${attempt.id}/submit`, { method: "POST" });
    router.push(`/student/evaluator/attempt/${attempt.id}/submitted`);
  }

  if (error && !attempt) {
    return (
      <article className="lesson-body wide eval-page">
        <p>
          <Link href="/student/evaluator">← Script evaluator</Link>
        </p>
        <p className="notice">{error}</p>
      </article>
    );
  }

  if (!attempt) {
    return (
      <article className="lesson-body wide eval-page">
        <p className="muted">Loading exam attempt…</p>
      </article>
    );
  }

  const ready = attemptFileCount(attempt) >= 3;

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Exam attempt</p>
      <h1>{attemptDisplayTitle(attempt)}</h1>
      <p className="muted">
        {attempt.exam_body} · {attempt.paper_code}. This selection is fixed for this attempt. To submit a different
        sitting or paper, start a new attempt.
      </p>

      <section className="eval-upload-block">
        <h2>1. Sitting BMCR</h2>
        <p>
          Use the one BMCR worksheet for this sitting. Reprint it here if you need another copy. You do the What I got /
          Basic Marks / % I could&apos;ve earned arithmetic yourself.
        </p>
        <p>
          <Link className="primary" href={worksheetHref(attempt.sitting_id)} target="_blank">
            Open printable sitting BMCR
          </Link>
        </p>
      </section>

      <section className="eval-upload-block">
        <h2>2. Upload three PDFs for this paper</h2>
        <p>Each file is stored against this attempt only. A PDF sitting in storage is not treated as analysed.</p>
        <div className="eval-upload-grid">
          {FILE_KINDS.map((kind) => {
            const present = attemptHasFile(attempt, kind);
            return (
              <label key={kind} className={`eval-upload-card${present ? " is-ready" : ""}`}>
                <span className="eval-upload-letter">{kind === "bmcr_worksheet" ? "A" : kind === "marked_script" ? "B" : "C"}</span>
                <strong>{EXAM_ATTEMPT_FILE_LABELS[kind]}</strong>
                <p className="muted small">{FILE_HELP[kind]}</p>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={Boolean(busyKind)}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    void onUpload(kind, file);
                  }}
                />
                <p className="muted small">
                  {busyKind === kind
                    ? "Uploading and reading pages…"
                    : present
                      ? attempt[`${kind}_name`] || "PDF uploaded"
                      : "PDF required"}
                </p>
              </label>
            );
          })}
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}

      <p>
        <button type="button" className="primary" disabled={!ready || submitting} onClick={onSubmit}>
          {submitting ? "Submitting…" : "Submit this exam attempt"}
        </button>
      </p>
      {!ready ? (
        <p className="muted small">Submit unlocks when all three PDFs are attached to this attempt.</p>
      ) : (
        <p className="muted small">You can leave after submit. The report is not generated on this screen.</p>
      )}
    </article>
  );
}
