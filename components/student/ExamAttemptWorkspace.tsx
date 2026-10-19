"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { worksheetHref } from "@/lib/bmcr-worksheet";
import {
  EXAM_ATTEMPT_FILE_LABELS,
  EXAM_ATTEMPT_SCRIPT_KINDS,
  attemptDisplayTitle,
  attemptHasAllRequiredFiles,
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

function fileName(attempt: ExamAttempt, kind: ExamAttemptFileKind): string {
  return String(attempt[`${kind}_name`] || "").trim();
}

function HiddenPdfPicker({
  disabled,
  busy,
  onPick,
}: {
  disabled: boolean;
  busy: boolean;
  onPick: (file: File | undefined) => void;
}) {
  return (
    <label className="eval-file-picker">
      <input
        className="eval-file-input"
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          onPick(file);
        }}
      />
      <span className="eval-file-button">{busy ? "Uploading…" : "Choose file"}</span>
    </label>
  );
}

function UploadStatus({
  attempt,
  kind,
  busy,
}: {
  attempt: ExamAttempt;
  kind: ExamAttemptFileKind;
  busy: boolean;
}) {
  const present = attemptHasFile(attempt, kind);
  const name = fileName(attempt, kind);
  return (
    <p className="muted small eval-upload-filename">
      {busy ? "Uploading and reading pages…" : present ? name || "PDF uploaded" : "PDF required"}
    </p>
  );
}

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

  const ready = attemptHasAllRequiredFiles(attempt);
  const scriptsReady = EXAM_ATTEMPT_SCRIPT_KINDS.every((kind) => attemptHasFile(attempt, kind));

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Exam attempt</p>
      <h1>{attemptDisplayTitle(attempt)}</h1>
      <p className="muted">
        {attempt.exam_body} · {attempt.sitting_label}. Upload the completed sitting BMCR, all three exam scripts, and
        the marking report for this sitting.
      </p>

      <section className="eval-upload-block">
        <h2>Sitting BMCR</h2>
        <p>
          Reprint the one sitting worksheet if you still need it. You do the What I got / Basic Marks / % I could&apos;ve
          earned arithmetic yourself.
        </p>
        <p>
          <Link className="eval-secondary" href={worksheetHref(attempt.sitting_id, `/student/evaluator/attempt/${attempt.id}`)}>
            Reprint sitting BMCR
          </Link>
        </p>
      </section>

      <section className="eval-upload-block">
        <h2>Upload the sitting PDFs</h2>
        <p>Each file is stored against this attempt only. A PDF sitting in storage is not treated as analysed.</p>
        <div className="eval-upload-grid">
          <label className={`eval-upload-card${attemptHasFile(attempt, "bmcr_worksheet") ? " is-ready" : ""}`}>
            <span className="eval-upload-letter">A</span>
            <strong>{EXAM_ATTEMPT_FILE_LABELS.bmcr_worksheet}</strong>
            <p className="muted small">The completed sitting BMCR — one handwritten sheet covers all three papers.</p>
            <HiddenPdfPicker
              disabled={Boolean(busyKind)}
              busy={busyKind === "bmcr_worksheet"}
              onPick={(file) => void onUpload("bmcr_worksheet", file)}
            />
            <UploadStatus attempt={attempt} kind="bmcr_worksheet" busy={busyKind === "bmcr_worksheet"} />
          </label>

          <div className={`eval-upload-card${scriptsReady ? " is-ready" : ""}`}>
            <span className="eval-upload-letter">B</span>
            <strong>Exam script</strong>
            <p className="muted small">Upload Paper 1, Paper 2 and Paper 3 as separate PDFs for this sitting.</p>
            <div className="eval-script-slots">
              {EXAM_ATTEMPT_SCRIPT_KINDS.map((kind) => (
                <div key={kind} className="eval-script-slot">
                  <span className="eval-script-slot-label">{EXAM_ATTEMPT_FILE_LABELS[kind]}</span>
                  <HiddenPdfPicker
                    disabled={Boolean(busyKind)}
                    busy={busyKind === kind}
                    onPick={(file) => void onUpload(kind, file)}
                  />
                  <UploadStatus attempt={attempt} kind={kind} busy={busyKind === kind} />
                </div>
              ))}
            </div>
          </div>

          <label className={`eval-upload-card${attemptHasFile(attempt, "marking_report") ? " is-ready" : ""}`}>
            <span className="eval-upload-letter">C</span>
            <strong>{EXAM_ATTEMPT_FILE_LABELS.marking_report}</strong>
            <p className="muted small">The official marking report / mark schedule for this sitting — not the script itself.</p>
            <HiddenPdfPicker
              disabled={Boolean(busyKind)}
              busy={busyKind === "marking_report"}
              onPick={(file) => void onUpload("marking_report", file)}
            />
            <UploadStatus attempt={attempt} kind="marking_report" busy={busyKind === "marking_report"} />
          </label>
        </div>
      </section>

      {error ? <p className="notice">{error}</p> : null}

      <p>
        <button type="button" className="primary" disabled={!ready || submitting} onClick={onSubmit}>
          {submitting ? "Submitting…" : "Submit this exam attempt"}
        </button>
      </p>
      {!ready ? (
        <p className="muted small">Submit unlocks when the BMCR, all three papers, and the marking report are attached.</p>
      ) : (
        <p className="muted small">You can leave after submit. The report is not generated on this screen.</p>
      )}
    </article>
  );
}
