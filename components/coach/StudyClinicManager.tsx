"use client";

import { useEffect, useState } from "react";
import StudyClinicResourceForm from "@/components/coach/StudyClinicResourceForm";
import {
  clipFromDraft,
  draftFromClip,
  emptyClinicDraft,
  inferStudyClinicKind,
  inferStudyClinicSection,
  STUDY_CLINIC_SECTIONS,
  studyClinicKindLabel,
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
    else setStatus(payload.error || "Could not load Study Clinic. Paste supabase/study-clinic.sql first.");
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (next: Partial<StudyClinicDraft>) => setDraft((current) => ({ ...current, ...next }));

  const save = async () => {
    const parsed = clipFromDraft(draft);
    if (!parsed.clip) {
      setStatus(parsed.error || "Fix this resource before saving.");
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
    if (!window.confirm("Remove this from Study Clinic?")) return;
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
        These items appear on the student Study Clinic library pages. You can also add videos, PDFs, and links while
        you are on each library page. Paste supabase/study-clinic-resources.sql once so PDFs and links can save.
      </p>
      {status ? <p className="notice">{status}</p> : null}

      <div className="rd-practice-list">
        {rows.length ? (
          rows.map((row) => (
            <div key={row.id} className="rd-sheet rd-row">
              <div>
                <b>{row.title}</b>
                <div className="muted small">
                  {STUDY_CLINIC_SECTIONS.find((section) => section.id === inferStudyClinicSection(row))?.title ||
                    "Study Advice"}
                  {` · ${studyClinicKindLabel(inferStudyClinicKind(row))}`}
                  {` · ${row.id}`}
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
          <p className="empty">No Study Clinic resources yet. Paste supabase/study-clinic.sql, then refresh.</p>
        )}
        <button type="button" className="ghost" onClick={() => setDraft(emptyClinicDraft())}>
          New resource
        </button>
      </div>

      <StudyClinicResourceForm
        draft={draft}
        onChange={set}
        onSave={() => void save()}
        onStatus={setStatus}
        busy={busy}
      />
    </div>
  );
}
