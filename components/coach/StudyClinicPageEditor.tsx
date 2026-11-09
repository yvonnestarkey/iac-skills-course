"use client";

import { useEffect, useState } from "react";
import StudyClinicResourceForm from "@/components/coach/StudyClinicResourceForm";
import RichTextField from "@/components/ui/RichTextField";
import {
  clipFromDraft,
  draftFromClip,
  emptyClinicDraft,
  inferStudyClinicKind,
  studyClinicKindLabel,
  type StudyClinicClip,
  type StudyClinicDraft,
  type StudyClinicPage,
  type StudyClinicSection,
} from "@/lib/study-clinic";

export default function StudyClinicPageEditor({
  section,
  clips,
  page,
  onChanged,
}: {
  section: StudyClinicSection;
  clips: StudyClinicClip[];
  page: StudyClinicPage;
  onChanged: (next?: { clip?: StudyClinicClip; page?: StudyClinicPage; removedId?: string }) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [intro, setIntro] = useState(page.intro);
  const [body, setBody] = useState(page.body);
  const [draft, setDraft] = useState<StudyClinicDraft>(() => emptyClinicDraft(section.id));

  useEffect(() => {
    setIntro(page.intro);
    setBody(page.body);
  }, [page.intro, page.body, section.id]);

  useEffect(() => {
    setDraft(emptyClinicDraft(section.id));
  }, [section.id]);

  const set = (next: Partial<StudyClinicDraft>) => setDraft((current) => ({ ...current, ...next }));

  const saveCopy = async () => {
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/coach/study-clinic/page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ section: section.id, intro, body }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setStatus(payload.error || "Could not save this page.");
      return;
    }
    setStatus("Library copy saved.");
    await onChanged({ page: payload.page || { section: section.id, intro, body } });
  };

  const saveResource = async () => {
    const parsed = clipFromDraft({ ...draft, section: section.id });
    if (!parsed.clip) {
      setStatus(parsed.error || "Fix this resource before saving.");
      return;
    }
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/coach/study-clinic", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, section: section.id, id: parsed.clip.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setStatus(payload.error || "Could not save.");
      return;
    }
    const clip = payload.clip || parsed.clip;
    setDraft(emptyClinicDraft(section.id));
    setStatus(`Saved “${clip.title}” to ${section.title}.`);
    await onChanged({ clip });
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
    if (draft.id === id) setDraft(emptyClinicDraft(section.id));
    await onChanged({ removedId: id });
  };

  return (
    <section className="coach-lesson-editor">
      <button className="ghost" type="button" onClick={() => setOpen((current) => !current)}>
        {open ? "Close library editor" : "Edit this library"}
      </button>
      {open ? (
        <div className="coach-lesson-editor-form">
          <p className="muted small">
            The lead line is page copy. A PDF, video, or link is a resource in the form below — use Save to this
            library. Paste supabase/study-clinic-sections.sql and supabase/study-clinic-resources.sql once if a save
            asks you to.
          </p>
          {status ? <p className="notice">{status}</p> : null}

          <div className="plan-field">
            <label htmlFor={`clinic-intro-${section.id}`}>
              <strong>Lead line</strong>
            </label>
            <RichTextField id={`clinic-intro-${section.id}`} rows={2} value={intro} onChange={setIntro} />
          </div>
          <div className="plan-field">
            <label htmlFor={`clinic-body-${section.id}`}>
              <strong>Extra notes</strong>
            </label>
            <RichTextField
              id={`clinic-body-${section.id}`}
              rows={4}
              value={body}
              onChange={setBody}
              hint="Optional. One paragraph per line."
            />
          </div>
          <div className="actions">
            <button className="ghost" type="button" disabled={busy} onClick={() => void saveCopy()}>
              {busy ? "Saving…" : "Save page copy"}
            </button>
          </div>

          <div className="rd-practice-list">
            {clips.length ? (
              clips.map((row) => (
                <div key={row.id} className="rd-sheet rd-row">
                  <div>
                    <b>{row.title}</b>
                    <div className="muted small">
                      {studyClinicKindLabel(inferStudyClinicKind(row))}
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
              <p className="empty">Nothing in this library yet. Add a video, PDF, or link below.</p>
            )}
            <button type="button" className="ghost" onClick={() => setDraft(emptyClinicDraft(section.id))}>
              New resource
            </button>
          </div>

          <StudyClinicResourceForm
            draft={draft}
            onChange={set}
            onSave={() => void saveResource()}
            onStatus={setStatus}
            busy={busy}
            lockSection
            saveLabel="Save to this library"
          />
        </div>
      ) : null}
    </section>
  );
}
