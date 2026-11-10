"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";
import {
  coachingSessionToWrite,
  deleteCoachingSession,
  emptyCoachingSessionWrite,
  fetchStudentCoachingSessions,
  saveManualCoachingSession,
  uploadCoachingSummaryPdf,
  type CoachingSessionWrite,
  type StudentCoachingSession,
} from "@/lib/coaching";

export default function StudentCoachingSessionsPanel({ studentId }: { studentId: string }) {
  const [sessions, setSessions] = useState<StudentCoachingSession[]>([]);
  const [form, setForm] = useState<CoachingSessionWrite>(emptyCoachingSessionWrite(studentId));
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = async () => {
    const rows = await fetchStudentCoachingSessions(studentId);
    setSessions(rows);
    setReady(true);
  };

  useEffect(() => {
    setForm(emptyCoachingSessionWrite(studentId));
    setError("");
    setNotice("");
    void load();
  }, [studentId]);

  const set = (next: Partial<CoachingSessionWrite>) => setForm((current) => ({ ...current, ...next }));

  const save = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    const result = await saveManualCoachingSession({ ...form, studentId });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setForm(emptyCoachingSessionWrite(studentId));
    setNotice("Saved. The student can open this from 1-on-1 Coaching.");
    await load();
  };

  const edit = (session: StudentCoachingSession) => {
    setForm(coachingSessionToWrite(session));
    setError("");
    setNotice(`Editing “${session.title || "1-on-1 coaching"}”.`);
  };

  const cancel = () => {
    setForm(emptyCoachingSessionWrite(studentId));
    setError("");
    setNotice("");
  };

  const remove = async (session: StudentCoachingSession) => {
    if (!window.confirm(`Remove “${session.title || "1-on-1 coaching"}” from this student?`)) return;
    setBusy(true);
    const result = await deleteCoachingSession(session.id);
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    if (form.id === session.id) setForm(emptyCoachingSessionWrite(studentId));
    setNotice("Removed.");
    await load();
  };

  const pickPdf = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError("");
    const result = await uploadCoachingSummaryPdf(studentId, file);
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    set({ pdfSummaryUrl: result.url });
    setNotice("Summary PDF uploaded. Save to put it on the student’s 1-on-1 page.");
  };

  const editing = Boolean(form.id);

  return (
    <section className="card">
      <h2>1-on-1 coaching</h2>
      <p className="muted small">
        Upload a PDF summary and paste a recording link. The student sees both on their 1-on-1 Coaching page. Fireflies
        imports land here too, when they work.
      </p>
      {error ? <p className="waiting">{error}</p> : null}
      {notice ? <p className="muted">{notice}</p> : null}

      <div className="coaching-manual-form">
        <label className="student-notes-label" htmlFor="coaching-title">
          Title (optional)
        </label>
        <input
          id="coaching-title"
          className="select-line"
          type="text"
          value={form.title}
          onChange={(event) => set({ title: event.target.value })}
          placeholder="1-on-1 coaching"
          disabled={busy}
        />
        <label className="student-notes-label" htmlFor="coaching-date">
          Session date (optional)
        </label>
        <input
          id="coaching-date"
          className="select-line"
          type="date"
          value={form.date}
          onChange={(event) => set({ date: event.target.value })}
          disabled={busy}
        />
        <label className="student-notes-label" htmlFor="coaching-recording">
          Recording link
        </label>
        <input
          id="coaching-recording"
          className="select-line"
          type="url"
          value={form.recordingUrl}
          onChange={(event) => set({ recordingUrl: event.target.value })}
          placeholder="https://vimeo.com/… or Zoom recording"
          disabled={busy}
        />
        <label className="student-notes-label" htmlFor="coaching-pdf">
          PDF summary
        </label>
        <input
          id="coaching-pdf"
          className="select-line"
          type="url"
          value={form.pdfSummaryUrl}
          onChange={(event) => set({ pdfSummaryUrl: event.target.value })}
          placeholder="https://… (PDF) or upload below"
          disabled={busy}
        />
        <input
          className="select-line"
          type="file"
          accept="application/pdf,.pdf"
          disabled={busy}
          onChange={(event) => {
            void pickPdf(event.target.files && event.target.files[0]);
            event.target.value = "";
          }}
        />
        <p className="coaching-actions">
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : editing ? "Save changes" : "Save to student page"}
          </button>
          {editing ? (
            <button type="button" className="ghost" disabled={busy} onClick={cancel}>
              Cancel
            </button>
          ) : null}
        </p>
      </div>

      {!ready ? <p className="empty">Loading coaching…</p> : null}
      {ready && !sessions.length ? <p className="empty">No coaching sessions yet. Add a PDF or recording above.</p> : null}
      {sessions.length ? (
        <div className="work-list">
          {sessions.map((session) => (
            <article key={session.id} className="coaching-session-card">
              <p>
                <strong>{session.title || "1-on-1 coaching"}</strong>
                {session.sessionAt ? <span className="muted"> · {formatSastDateTime(session.sessionAt)}</span> : null}
              </p>
              {session.summaryText ? <p className="coaching-summary">{session.summaryText}</p> : null}
              <p className="coaching-actions">
                {session.recordingUrl ? (
                  <a className="primary" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                    Watch recording
                  </a>
                ) : null}
                {session.pdfSummaryUrl ? (
                  <a className="ghost" href={session.pdfSummaryUrl} target="_blank" rel="noopener noreferrer">
                    Open PDF summary
                  </a>
                ) : null}
                {session.firefliesTranscriptUrl ? (
                  <a className="ghost" href={session.firefliesTranscriptUrl} target="_blank" rel="noopener noreferrer">
                    Open in Fireflies
                  </a>
                ) : null}
                <button type="button" className="ghost" disabled={busy} onClick={() => edit(session)}>
                  Edit
                </button>
                <button type="button" className="ghost" disabled={busy} onClick={() => void remove(session)}>
                  Remove
                </button>
              </p>
              {session.transcriptText ? (
                <details className="coaching-transcript">
                  <summary>Transcript</summary>
                  <pre>{session.transcriptText}</pre>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
