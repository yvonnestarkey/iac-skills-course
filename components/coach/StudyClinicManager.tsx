"use client";

import { useEffect, useState } from "react";
import {
  clipFromDraft,
  draftFromClip,
  emptyClinicDraft,
  type StudyClinicClip,
  type StudyClinicDraft,
} from "@/lib/study-clinic";

export default function StudyClinicManager() {
  const [rows, setRows] = useState<StudyClinicClip[]>([]);
  const [draft, setDraft] = useState<StudyClinicDraft>(emptyClinicDraft());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/coach/study-clinic");
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setRows(payload.clips || []);
    else setStatus(payload.error || "Could not load Study Clinic videos. Paste supabase/study-clinic.sql first.");
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (next: Partial<StudyClinicDraft>) => setDraft((current) => ({ ...current, ...next }));

  const save = async () => {
    const parsed = clipFromDraft(draft);
    if (!parsed.clip) {
      setStatus(parsed.error || "Fix the video before saving.");
      return;
    }
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/coach/study-clinic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, id: parsed.clip.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setStatus(payload.error || "Could not save.");
      return;
    }
    setDraft(draftFromClip(payload.clip));
    setStatus("Saved to Study Clinic.");
    await load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("Remove this video from Study Clinic?")) return;
    setBusy(true);
    const response = await fetch(`/api/coach/study-clinic/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatus(payload.error || "Could not delete.");
      return;
    }
    if (draft.id === id) setDraft(emptyClinicDraft());
    await load();
  };

  return (
    <div className="rd-practice-admin">
      <p className="muted small">
        These videos appear on the student Study Clinic page. They no longer belong in Course content once you have
        copied them with the Study Clinic SQL.
      </p>
      {status ? <p className="notice">{status}</p> : null}

      <div className="rd-practice-list">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rd-sheet rd-row">
              <div>
                <b>{row.title}</b>
                <div className="muted small">
                  {row.id}
                  {row.duration ? ` · ${row.duration}` : ""}
                  {row.published ? "" : " · hidden"}
                </div>
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => setDraft(draftFromClip(row))}>
                  Edit
                </button>
                <button type="button" className="ghost" disabled={busy} onClick={() => void remove(row.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        ) : (
          <p className="empty">No Study Clinic videos yet. Paste supabase/study-clinic.sql, then refresh.</p>
        )}
        <button type="button" className="ghost" onClick={() => setDraft(emptyClinicDraft())}>
          New video
        </button>
      </div>

      <div className="rd-practice-form">
        <label>
          Title
          <input value={draft.title} onChange={(event) => set({ title: event.target.value })} />
        </label>
        <label>
          Id
          <input value={draft.id} onChange={(event) => set({ id: event.target.value })} placeholder="auto from title" />
        </label>
        <label>
          Duration
          <input value={draft.duration} onChange={(event) => set({ duration: event.target.value })} placeholder="8 min" />
        </label>
        <label>
          Order
          <input value={draft.position} onChange={(event) => set({ position: event.target.value })} placeholder="1" />
        </label>
        <label className="rd-span">
          Blurb
          <textarea rows={3} value={draft.blurb} onChange={(event) => set({ blurb: event.target.value })} />
        </label>
        <label className="rd-span">
          Video URLs
          <span className="muted small">One Vimeo or YouTube URL per line, in the order students should watch them.</span>
          <textarea
            rows={6}
            value={draft.videoUrlsText}
            onChange={(event) => set({ videoUrlsText: event.target.value })}
            placeholder="https://player.vimeo.com/video/123"
          />
        </label>
        <label className="rd-check">
          <input type="checkbox" checked={draft.published} onChange={(event) => set({ published: event.target.checked })} />
          Published to students
        </label>
        <div className="actions">
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save Study Clinic video"}
          </button>
        </div>
      </div>
    </div>
  );
}
