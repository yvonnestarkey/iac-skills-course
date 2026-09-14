"use client";

import { useEffect, useState } from "react";
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
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setBody(saved?.body || "");
    setLinkUrl(saved?.link_url || "");
  }, [lessonId, saved?.body, saved?.link_url]);

  const submit = async () => {
    if (!body.trim() && !linkUrl.trim()) {
      setStatus("Add your written work or a link before submitting.");
      return;
    }
    setBusy(true);
    setStatus("");
    const result = await saveStudentSubmission({ studentId, lessonId, body, linkUrl });
    setBusy(false);
    if (!result.ok || !result.submission) {
      setStatus(result.error || "Could not save your submission. Run supabase/submissions.sql in the SQL editor if this table is new.");
      return;
    }
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

      {status ? <p className="notice">{status}</p> : null}
      <div className="actions">
        <button className="primary" type="button" disabled={busy} onClick={submit}>
          {busy ? "Saving…" : label}
        </button>
      </div>
    </section>
  );
}
