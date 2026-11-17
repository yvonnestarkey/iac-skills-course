"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";
import {
  coachingPdfFiles,
  coachingSessionStatusLabel,
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
    await fetch("/api/student/coaching/sync", { method: "POST" }).catch(() => undefined);
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

  const pickPdfs = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError("");
    const added: CoachingSessionWrite["pdfFiles"] = [];
    for (const file of Array.from(list)) {
      const result = await uploadCoachingSummaryPdf(studentId, file);
      if (result.ok === false) {
        setError(result.error);
        break;
      }
      added.push({ url: result.url, name: result.name });
    }
    if (added.length) {
      setForm((current) => ({ ...current, pdfFiles: [...current.pdfFiles, ...added] }));
      setNotice(
        added.length === 1
          ? "PDF uploaded. Save to put it on the student’s 1-on-1 page."
          : `${added.length} PDFs uploaded. Save to put them on the student’s 1-on-1 page.`
      );
    }
    setBusy(false);
  };

  const editing = Boolean(form.id);

  return (
    <section className="card">
      <h2>1-on-1 coaching</h2>
      <p className="muted small">
        Booked 1-on-1s from Google Calendar appear here as soon as they land on your calendar, and that closes the
        student booking link. After the call, paste take-aways into Executive summary, add the recording, and upload
        one or more PDFs if relevant. Fireflies transcripts land on the student page automatically.
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
        <label className="student-notes-label" htmlFor="coaching-exec">
          Executive summary (take-aways)
        </label>
        <textarea
          id="coaching-exec"
          className="select-line coaching-exec-input"
          rows={8}
          value={form.executiveSummary}
          onChange={(event) => set({ executiveSummary: event.target.value })}
          placeholder="Paste the take-aways from this session. Students see this on the right of the 1-on-1 board."
          disabled={busy}
        />
        <label className="student-notes-label" htmlFor="coaching-pdfs">
          PDFs (if relevant)
        </label>
        {form.pdfFiles.length ? (
          <ul className="coaching-pdf-list">
            {form.pdfFiles.map((file) => (
              <li key={file.url}>
                <a href={file.url} target="_blank" rel="noopener noreferrer">
                  {file.name || "PDF"}
                </a>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => set({ pdfFiles: form.pdfFiles.filter((item) => item.url !== file.url) })}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          id="coaching-pdfs"
          className="select-line"
          type="file"
          accept="application/pdf,.pdf"
          multiple
          disabled={busy}
          onChange={(event) => {
            void pickPdfs(event.target.files);
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
      {ready && !sessions.length ? (
        <p className="empty">No coaching sessions yet. A booking on your Google Calendar will show here.</p>
      ) : null}
      {sessions.length ? (
        <div className="work-list">
          {sessions.map((session) => {
            const pdfs = coachingPdfFiles(session);
            return (
              <article key={session.id} className="coaching-session-card">
                <p>
                  <strong>{session.title || "1-on-1 coaching"}</strong>
                  <span className="muted"> · {coachingSessionStatusLabel(session.status)}</span>
                  {session.sessionAt ? <span className="muted"> · {formatSastDateTime(session.sessionAt)}</span> : null}
                </p>
                {session.coachNotes ? <p className="coaching-summary">{session.coachNotes}</p> : null}
                <p className="coaching-actions">
                  {session.recordingUrl ? (
                    <a className="primary" href={session.recordingUrl} target="_blank" rel="noopener noreferrer">
                      Watch recording
                    </a>
                  ) : null}
                  {pdfs.map((file) => (
                    <a key={file.url} className="ghost" href={file.url} target="_blank" rel="noopener noreferrer">
                      {file.name || "PDF"}
                    </a>
                  ))}
                  {session.meetingUrl && session.status === "scheduled" ? (
                    <a className="ghost" href={session.meetingUrl} target="_blank" rel="noopener noreferrer">
                      Open calendar event
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
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
