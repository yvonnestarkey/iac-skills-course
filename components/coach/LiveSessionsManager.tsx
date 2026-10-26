"use client";

import { useEffect, useState } from "react";
import CoachToolPanel from "@/components/coach/CoachToolPanel";
import {
  deleteLiveSession,
  emptyLiveSessionWrite,
  formatLiveSessionAt,
  listLiveSessions,
  liveSessionIsRecorded,
  liveSessionToWrite,
  saveLiveSession,
  uploadLiveSessionPdf,
  type LiveSession,
  type LiveSessionWrite,
} from "@/lib/live-sessions";
import RichTextField from "@/components/ui/RichTextField";

function PdfField({
  id,
  label,
  hint,
  value,
  disabled,
  onUrl,
  onFile,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  disabled: boolean;
  onUrl: (url: string) => void;
  onFile: (file: File | null) => void;
}) {
  return (
    <div className="plan-field">
      <label htmlFor={id}>
        <strong>{label}</strong>
      </label>
      <input
        id={id}
        type="url"
        className="select-line"
        placeholder="https://… (PDF)"
        value={value}
        onChange={(event) => onUrl(event.target.value)}
      />
      <input
        className="select-line live-session-file"
        type="file"
        accept="application/pdf,.pdf"
        disabled={disabled}
        onChange={(event) => {
          onFile(event.target.files && event.target.files[0]);
          event.target.value = "";
        }}
      />
      <p className="muted small">{hint}</p>
    </div>
  );
}

export default function LiveSessionsManager() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [form, setForm] = useState<LiveSessionWrite>(emptyLiveSessionWrite());
  const [status, setStatus] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);

  const load = async () => {
    const listed = await listLiveSessions();
    if (listed.ok === false) {
      setStatus({ kind: "warn", text: listed.error });
      setReady(true);
      return;
    }
    setSessions(listed.sessions);
    setReady(true);
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (next: Partial<LiveSessionWrite>) => setForm((current) => ({ ...current, ...next }));

  const startEdit = (session: LiveSession) => {
    setForm(liveSessionToWrite(session));
    setStatus({ kind: "ok", text: `Editing “${session.title}”. Add the recording, summary, and scribbles after the session.` });
  };

  const reset = () => {
    setForm(emptyLiveSessionWrite());
    setStatus(null);
  };

  const save = async () => {
    setBusy(true);
    const result = await saveLiveSession(form);
    setBusy(false);
    if (result.ok === false) {
      setStatus({ kind: "warn", text: result.error });
      return;
    }
    await load();
    setForm(emptyLiveSessionWrite());
    setStatus({
      kind: "ok",
      text: form.id
        ? "Live session updated. Students see it under Live sessions."
        : "Live session added. Students can join from Live sessions when the Zoom link is set.",
    });
  };

  const remove = async (session: LiveSession) => {
    if (!window.confirm(`Remove “${session.title}” from the student Live sessions page?`)) return;
    setBusy(true);
    const result = await deleteLiveSession(session.id);
    setBusy(false);
    if (result.ok === false) {
      setStatus({ kind: "warn", text: result.error });
      return;
    }
    if (form.id === session.id) setForm(emptyLiveSessionWrite());
    await load();
    setStatus({ kind: "ok", text: "Live session removed." });
  };

  const pickPdf = async (kind: "summary" | "notes", file: File | null) => {
    if (!file) return;
    setBusy(true);
    const result = await uploadLiveSessionPdf(file, kind);
    setBusy(false);
    if (result.ok === false) {
      setStatus({ kind: "warn", text: result.error });
      return;
    }
    if (kind === "summary") set({ summaryPdfUrl: result.url });
    else set({ notesPdfUrl: result.url });
    setStatus({ kind: "ok", text: kind === "summary" ? "Summary PDF uploaded." : "Scribbles PDF uploaded." });
  };

  const editing = Boolean(form.id);

  return (
    <CoachToolPanel
      title="Live sessions"
      description="Add an upcoming Zoom link with the date and time (SAST). After the session, edit it to add the recording, summary notes, and scribbles — the same fields as 22 September."
      open={open}
      onToggle={() => setOpen((current) => !current)}
    >
      <div className="live-session-manager">
      {status ? <div className={status.kind === "ok" ? "notice" : "waiting"}>{status.text}</div> : null}

      <div className="profile-grid">
        <div>
          <h3>{editing ? "Edit live session" : "Add a live session"}</h3>
          <div className="plan-field">
            <label htmlFor="ls-title">
              <strong>Title</strong>
            </label>
            <input
              id="ls-title"
              type="text"
              className="select-line"
              placeholder="Live coaching session"
              value={form.title}
              onChange={(event) => set({ title: event.target.value })}
            />
          </div>
          <div className="plan-field">
            <label htmlFor="ls-description">
              <strong>Description</strong>
            </label>
            <RichTextField
              id="ls-description"
              rows={2}
              value={form.description}
              onChange={(description) => set({ description })}
              placeholder="Optional. Shown under the title."
            />
          </div>
          <div className="hours-row live-session-when-fields">
            <div className="plan-field">
              <label htmlFor="ls-date">
                <strong>Date</strong>
              </label>
              <input id="ls-date" type="date" value={form.date} onChange={(event) => set({ date: event.target.value })} />
            </div>
            <div className="plan-field">
              <label htmlFor="ls-time">
                <strong>Time (SAST)</strong>
              </label>
              <input id="ls-time" type="time" value={form.time} onChange={(event) => set({ time: event.target.value })} />
            </div>
            <div className="plan-field">
              <label htmlFor="ls-status">
                <strong>Status</strong>
              </label>
              <select
                id="ls-status"
                className="select-line"
                value={form.status}
                onChange={(event) => set({ status: event.target.value as LiveSessionWrite["status"] })}
              >
                <option value="upcoming">Upcoming</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="plan-field">
            <label htmlFor="ls-zoom">
              <strong>Zoom link</strong>
            </label>
            <input
              id="ls-zoom"
              type="url"
              className="select-line"
              placeholder="https://zoom.us/j/…"
              value={form.zoomUrl}
              onChange={(event) => set({ zoomUrl: event.target.value })}
            />
            <p className="muted small">Students see Join Zoom Meeting until a recording is added.</p>
          </div>
          <div className="plan-field">
            <label htmlFor="ls-recording">
              <strong>Recording link</strong>
            </label>
            <input
              id="ls-recording"
              type="url"
              className="select-line"
              placeholder="https://vimeo.com/… or Zoom recording"
              value={form.recordingUrl}
              onChange={(event) => set({ recordingUrl: event.target.value, status: event.target.value.trim() ? "completed" : form.status })}
            />
            <p className="muted small">Paste this after the session. It replaces the Zoom button with Watch Recording.</p>
          </div>
          <PdfField
            id="ls-summary"
            label="Session summary (PDF)"
            hint="Upload or paste the summary notes PDF."
            value={form.summaryPdfUrl}
            disabled={busy}
            onUrl={(summaryPdfUrl) => set({ summaryPdfUrl })}
            onFile={(file) => void pickPdf("summary", file)}
          />
          <PdfField
            id="ls-notes"
            label="Scribbles / notes (PDF)"
            hint="Upload or paste the scribbles PDF — same as 22 September."
            value={form.notesPdfUrl}
            disabled={busy}
            onUrl={(notesPdfUrl) => set({ notesPdfUrl })}
            onFile={(file) => void pickPdf("notes", file)}
          />
          <div className="actions">
            <button className="primary" type="button" onClick={() => void save()} disabled={busy}>
              {busy ? "Saving…" : editing ? "Save live session" : "Add live session"}
            </button>
            {editing ? (
              <button className="ghost" type="button" onClick={reset} disabled={busy}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </div>

        <div>
          <h3>On the student page</h3>
          {!ready ? <p className="muted small">Loading live sessions…</p> : null}
          {ready && !sessions.length ? (
            <p className="muted small">No live sessions yet. Add the next Zoom date here.</p>
          ) : null}
          <ul className="live-session-admin-list">
            {sessions.map((session) => (
              <li key={session.id} className="live-session-admin-row">
                <div>
                  <strong>{session.title}</strong>
                  <p className="muted small">
                    {formatLiveSessionAt(session.sessionAt) || "Date TBC"}
                    {liveSessionIsRecorded(session) ? " · recording" : session.zoomUrl ? " · Zoom" : ""}
                    {session.summaryPdfUrl ? " · summary" : ""}
                    {session.notesPdfUrl ? " · scribbles" : ""}
                  </p>
                </div>
                <div className="actions">
                  <button className="ghost" type="button" onClick={() => startEdit(session)} disabled={busy}>
                    Edit
                  </button>
                  <button className="ghost" type="button" onClick={() => void remove(session)} disabled={busy}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      </div>
    </CoachToolPanel>
  );
}
