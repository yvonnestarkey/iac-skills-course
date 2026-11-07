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
import FeedbackLog from "@/components/feedback/FeedbackLog";
import { hasWrittenFeedback } from "@/lib/feedback-log";
import {
  mergeSubmissionFiles,
  saveStudentSubmission,
  submissionFiles,
  uploadAssignmentFile,
  type StudentSubmission,
  type SubmissionFile,
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
  const [files, setFiles] = useState(() => submissionFiles(saved));
  const [bmcr, setBmcr] = useState<BmcrValue>(EMPTY_BMCR_VALUE);
  const [bmcrId, setBmcrId] = useState<string | undefined>();
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const savedFileKey = submissionFiles(saved)
    .map((file) => file.url)
    .join("|");

  useEffect(() => {
    setBody(saved?.body || "");
    setFiles(submissionFiles(saved));
  }, [lessonId, saved?.body, saved?.link_url, savedFileKey]);

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

  const persistFiles = async (nextFiles: SubmissionFile[], alreadySubmitted: boolean) => {
    if (!alreadySubmitted) return true;
    const result = await saveStudentSubmission({
      studentId,
      lessonId,
      body,
      linkUrl: nextFiles[0]?.url || "",
      files: nextFiles,
      status: saved?.status,
    });
    if (!result.ok || !result.submission) {
      setStatus(result.error || "The extra PDF uploaded, but it could not be saved on your submission.");
      return false;
    }
    void fetch("/api/student/assignment-submitted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
    onSaved?.(result.submission);
    return true;
  };

  const pickFiles = async (chosen: File[]) => {
    if (!chosen.length) return;
    setBusy(true);
    setStatus(chosen.length > 1 ? "Uploading PDFs…" : "Uploading PDF…");
    const added: SubmissionFile[] = [];
    for (const file of chosen) {
      const result = await uploadAssignmentFile(studentId, lessonId, file);
      if (result.ok === false) {
        if (added.length) setFiles((current) => mergeSubmissionFiles(current, added));
        setBusy(false);
        setStatus(result.error);
        return;
      }
      added.push({ url: result.url, name: result.name });
    }
    const nextFiles = mergeSubmissionFiles(files, added);
    setFiles(nextFiles);
    const savedExtra = await persistFiles(nextFiles, Boolean(saved));
    setBusy(false);
    if (!savedExtra) return;
    if (saved) {
      setStatus(nextFiles.length > 1 ? "PDF added. Your earlier files are still saved." : "PDF uploaded.");
      return;
    }
    setStatus(
      nextFiles.length > 1
        ? "PDFs uploaded. Complete the BMCR, then submit."
        : "PDF uploaded. Complete the BMCR, then submit."
    );
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
    if (!files.length) {
      setStatus("Upload your PDF before submitting.");
      return;
    }
    setBusy(true);
    setStatus("");
    const result = await saveStudentSubmission({
      studentId,
      lessonId,
      body,
      linkUrl: files[0]?.url || "",
      files,
    });
    if (!result.ok || !result.submission) {
      setBusy(false);
      setStatus(result.error || "Could not save your submission.");
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
    void fetch("/api/student/assignment-submitted", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId }),
    });
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
        <p className="muted">Upload your marked PDF and complete the BMCR. If you forget a file, add it here — it will not replace the ones you already uploaded.</p>
      )}
      {practiceOnly ? null : saved?.status === "approved" ? <p className="notice">Your coach approved this submission.</p> : null}
      {practiceOnly ? null : saved?.status === "rejected" ? <p className="notice">Your coach asked for an update. Resubmit when you are ready.</p> : null}
      {!practiceOnly && hasWrittenFeedback(saved?.feedback) ? (
        <aside className="survey-info-card survey-review-card">
          <strong>Coach feedback</strong>
          <FeedbackLog raw={saved?.feedback} />
          {saved?.feedbackFileUrl ? (
            <a className="ghost" href={saved.feedbackFileUrl} target="_blank" rel="noopener noreferrer">
              Open coach file ↗
            </a>
          ) : null}
        </aside>
      ) : null}
      {!practiceOnly && saved?.status === "submitted" && requiresCoachApproval ? (
        <p className="notice">Waiting for coach approval.</p>
      ) : null}

      {practiceOnly ? null : (
        <>
          {files.length ? (
            <div className="submission-files">
              {files.map((file, index) => (
                <div className="file-card" key={file.url}>
                  <span className="file-icon">PDF</span>
                  <div className="file-meta">
                    <strong>{file.name || "Uploaded PDF"}</strong>
                    <span className="muted small">
                      {index === 0 && files.length === 1 ? "Ready to submit" : `File ${index + 1} of ${files.length}`}
                    </span>
                  </div>
                  <a className="ghost" href={file.url} target="_blank" rel="noopener noreferrer">
                    Open PDF
                  </a>
                </div>
              ))}
            </div>
          ) : null}
          <label className="dropzone" htmlFor="submission-file">
            <strong>{files.length ? "Add another PDF" : "Choose a PDF to upload"}</strong>
            <span className="muted small">
              {busy ? "Uploading…" : files.length ? "Your earlier files stay saved · PDF only" : "PDF only · scans are fine"}
            </span>
            <input
              id="submission-file"
              type="file"
              accept="application/pdf,.pdf"
              multiple
              disabled={busy}
              onChange={(event) => {
                const chosen = Array.from(event.target.files || []);
                event.target.value = "";
                if (!chosen.length) return;
                void pickFiles(chosen);
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
