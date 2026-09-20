"use client";

import { useEffect, useState } from "react";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  EMPTY_BMCR_VALUE,
  fetchLessonBmcrEvaluation,
  hasBmcrData,
  hasBmcrDiagnostics,
  saveBmcrEvaluation,
  withDiagnostics,
  type BmcrValue,
} from "@/lib/bmcr";
import { saveStudentSubmission, uploadAssignmentFile, type StudentSubmission } from "@/lib/student-submissions";

export default function LessonSubmissionForm({
  lessonId,
  studentId,
  requiresCoachApproval,
  saved,
  onSaved,
}: {
  lessonId: string;
  studentId: string;
  requiresCoachApproval: boolean;
  saved?: StudentSubmission | null;
  onSaved?: (submission: StudentSubmission) => void;
}) {
  const [body, setBody] = useState(saved?.body || "");
  const [linkUrl, setLinkUrl] = useState(saved?.link_url || "");
  const [fileName, setFileName] = useState("");
  const [bmcr, setBmcr] = useState<BmcrValue>(EMPTY_BMCR_VALUE);
  const [bmcrId, setBmcrId] = useState<string | undefined>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBody(saved?.body || "");
    setLinkUrl(saved?.link_url || "");
  }, [lessonId, saved?.body, saved?.link_url]);

  useEffect(() => {
    let cancelled = false;
    fetchLessonBmcrEvaluation(studentId, lessonId).then((existing) => {
      if (cancelled || !existing) return;
      setBmcrId(existing.id);
      setBmcr(withDiagnostics(existing));
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, lessonId]);

  const pickFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setStatus("");
    const result = await uploadAssignmentFile(studentId, lessonId, file);
    setBusy(false);
    if (result.ok === false) {
      setStatus(result.error);
      return;
    }
    setLinkUrl(result.url);
    setFileName(result.name);
    setStatus("PDF uploaded. Complete the BMCR, then submit.");
  };

  const submit = async () => {
    if (!linkUrl.trim()) {
      setStatus("Upload your PDF before submitting.");
      return;
    }
    setBusy(true);
    setStatus("");
    const result = await saveStudentSubmission({ studentId, lessonId, body, linkUrl });
    if (!result.ok || !result.submission) {
      setBusy(false);
      setStatus(result.error || "Could not save your submission. Run supabase/submissions.sql in the SQL editor if this table is new.");
      return;
    }
    if (hasBmcrData(bmcr) || hasBmcrDiagnostics(bmcr)) {
      const bmcrResult = await saveBmcrEvaluation({
        studentId,
        assignmentId: lessonId,
        marks: bmcr,
        existingId: bmcrId,
      });
      if (bmcrResult.evaluation?.id) setBmcrId(bmcrResult.evaluation.id);
      if (!bmcrResult.ok) {
        setBusy(false);
        onSaved?.(result.submission);
        setStatus(bmcrResult.error || "Submission saved, but the BMCR could not be stored.");
        return;
      }
    }
    setBusy(false);
    onSaved?.(result.submission);
    setStatus(
      requiresCoachApproval ? "Submitted. This stays locked for later lessons until your coach approves it." : "Submission saved."
    );
  };

  const label =
    saved?.status === "approved"
      ? "Approved"
      : saved?.status === "rejected"
        ? "Returned — update and resubmit"
        : saved
          ? "Update submission"
          : "Submit work";

  return (
    <section className="submission-form" aria-labelledby="submission-heading">
      <h2 id="submission-heading">Submission</h2>
      {requiresCoachApproval ? (
        <p className="muted">Your coach must approve this before later lessons unlock.</p>
      ) : (
        <p className="muted">Upload your marked PDF and complete the BMCR.</p>
      )}
      {saved?.status === "approved" ? <p className="notice">Your coach approved this submission.</p> : null}
      {saved?.status === "rejected" ? <p className="notice">Your coach asked for an update. Resubmit when you are ready.</p> : null}
      {saved?.status === "submitted" && requiresCoachApproval ? (
        <p className="notice">Waiting for coach approval.</p>
      ) : null}

      <label className="student-notes-label" htmlFor="submission-file">
        PDF upload
      </label>
      <input
        id="submission-file"
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        onChange={(event) => {
          void pickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      {linkUrl ? (
        <p className="muted small">
          {fileName ? <strong>{fileName} </strong> : null}
          <a href={linkUrl} target="_blank" rel="noopener noreferrer">
            View uploaded PDF
          </a>
        </p>
      ) : null}

      <h3 className="bmcr-submission-heading">BMCR Calculator</h3>
      <p className="muted small">Optional. Enter marks from your marked attempt. Basic Marks % and BMCR update as you type.</p>
      <BmcrCalculator value={bmcr} onChange={setBmcr} idPrefix={`submission-${lessonId}`} />

      {status ? <p className="notice">{status}</p> : null}
      <div className="actions">
        <button className="primary" type="button" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : label}
        </button>
      </div>
    </section>
  );
}
