"use client";

import { useEffect, useState } from "react";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  EMPTY_BMCR_MARKS,
  fetchLessonBmcrEvaluation,
  hasBmcrData,
  saveBmcrEvaluation,
  type BmcrMarks,
} from "@/lib/bmcr";
import { saveStudentSubmission, type StudentSubmission } from "@/lib/student-submissions";

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
  const [bmcr, setBmcr] = useState<BmcrMarks>(EMPTY_BMCR_MARKS);
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
      setBmcr({
        basic_my_marks: existing.basic_my_marks,
        basic_markplan: existing.basic_markplan,
        average_my_marks: existing.average_my_marks,
        average_markplan: existing.average_markplan,
        higher_my_marks: existing.higher_my_marks,
        higher_markplan: existing.higher_markplan,
        question_total_my_marks: existing.question_total_my_marks,
        question_total_markplan: existing.question_total_markplan,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [studentId, lessonId]);

  const submit = async () => {
    if (!body.trim() && !linkUrl.trim()) {
      setStatus("Add your written work or a link before submitting.");
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
    if (hasBmcrData(bmcr)) {
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
        <p className="muted">Submit written work, a link to a file, or both.</p>
      )}
      {saved?.status === "approved" ? <p className="notice">Your coach approved this submission.</p> : null}
      {saved?.status === "rejected" ? <p className="notice">Your coach asked for an update. Resubmit when you are ready.</p> : null}
      {saved?.status === "submitted" && requiresCoachApproval ? (
        <p className="notice">Waiting for coach approval.</p>
      ) : null}

      <label className="student-notes-label" htmlFor="submission-body">
        Written response
      </label>
      <textarea
        id="submission-body"
        rows={8}
        placeholder="Type your working here…"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />

      <label className="student-notes-label" htmlFor="submission-link">
        Link to your file (optional)
      </label>
      <input
        id="submission-link"
        type="url"
        className="select-line"
        placeholder="https://"
        value={linkUrl}
        onChange={(event) => setLinkUrl(event.target.value)}
      />

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
