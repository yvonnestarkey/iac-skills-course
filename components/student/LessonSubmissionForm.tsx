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
import {
  copyPickedFile,
  fileNameFromUrl,
  saveStudentSubmission,
  uploadAssignmentFile,
  type StudentSubmission,
} from "@/lib/student-submissions";

export default function LessonSubmissionForm({
  lessonId,
  studentId,
  requiresCoachApproval,
  saved,
  onSaved,
  practiceOnly = false,
}: {
  lessonId: string;
  studentId: string;
  requiresCoachApproval: boolean;
  saved?: StudentSubmission | null;
  onSaved?: (submission?: StudentSubmission) => void;
  practiceOnly?: boolean;
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
    setFileName(saved?.link_url ? fileNameFromUrl(saved.link_url) : "");
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
    setFileName(file.name);
    setBusy(true);
    setStatus("Uploading PDF…");
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

  const savePracticeBmcr = async () => {
    if (!hasBmcrData(bmcr) && !hasBmcrDiagnostics(bmcr)) {
      setStatus("Enter your marks before saving the BMCR.");
      return;
    }
    setBusy(true);
    setStatus("");
    const bmcrResult = await saveBmcrEvaluation({
      studentId,
      assignmentId: lessonId,
      marks: bmcr,
      existingId: bmcrId,
    });
    if (bmcrResult.evaluation?.id) setBmcrId(bmcrResult.evaluation.id);
    setBusy(false);
    if (!bmcrResult.ok) {
      setStatus(bmcrResult.error || "Could not save the BMCR.");
      return;
    }
    onSaved?.();
    setStatus("BMCR saved. You do not need to upload this attempt.");
  };

  const submit = async () => {
    if (practiceOnly) {
      await savePracticeBmcr();
      return;
    }
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

  const label = practiceOnly
    ? bmcrId
      ? "Update BMCR"
      : "Save BMCR"
    : saved?.status === "approved"
      ? "Approved"
      : saved?.status === "rejected"
        ? "Returned — update and resubmit"
        : saved
          ? "Update submission"
          : "Submit work";

  return (
    <section className="submission-form" aria-labelledby="submission-heading">
      <h2 id="submission-heading">{practiceOnly ? "BMCR Calculator" : "Submission"}</h2>
      {practiceOnly ? (
        <p className="muted">You do not need to upload this attempt. Enter marks from your marked attempt so you can see Basic Marks % and BMCR.</p>
      ) : requiresCoachApproval ? (
        <p className="muted">Your coach must approve this before later lessons unlock.</p>
      ) : (
        <p className="muted">Upload your marked PDF and complete the BMCR.</p>
      )}
      {practiceOnly ? null : saved?.status === "approved" ? <p className="notice">Your coach approved this submission.</p> : null}
      {practiceOnly ? null : saved?.status === "rejected" ? <p className="notice">Your coach asked for an update. Resubmit when you are ready.</p> : null}
      {!practiceOnly && saved?.status === "submitted" && requiresCoachApproval ? (
        <p className="notice">Waiting for coach approval.</p>
      ) : null}

      {practiceOnly ? null : (
        <>
          {linkUrl ? (
            <div className="file-card">
              <span className="file-icon">PDF</span>
              <div className="file-meta">
                <strong>{fileName || "Uploaded PDF"}</strong>
                <span className="muted small">Ready to submit</span>
              </div>
              <a className="ghost" href={linkUrl} target="_blank" rel="noopener noreferrer">
                Open PDF
              </a>
            </div>
          ) : null}
          <label className="dropzone" htmlFor="submission-file">
            <strong>{linkUrl ? "Replace your PDF" : "Choose a PDF to upload"}</strong>
            <span className="muted small">{busy ? "Uploading…" : "PDF only · scans are fine"}</span>
            {fileName && !linkUrl ? <span className="muted small">Selected: {fileName}</span> : null}
            <input
              id="submission-file"
              type="file"
              accept="application/pdf,.pdf"
              disabled={busy}
              onChange={(event) => {
                const chosen = event.target.files?.[0];
                if (!chosen) return;
                const copy = copyPickedFile(chosen);
                event.target.value = "";
                void pickFile(copy);
              }}
            />
          </label>
          {status ? <p className="notice">{status}</p> : null}

          <h3 className="bmcr-submission-heading">BMCR Calculator</h3>
          <p className="muted small">Optional. Enter marks from your marked attempt. Basic Marks % and BMCR update as you type.</p>
        </>
      )}
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
