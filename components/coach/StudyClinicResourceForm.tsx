"use client";

import { uploadLessonPdf } from "@/lib/content";
import {
  inferStudyClinicSection,
  STUDY_CLINIC_KINDS,
  STUDY_CLINIC_SECTIONS,
  studyClinicKindLabel,
  type StudyClinicDraft,
  type StudyClinicKind,
} from "@/lib/study-clinic";

export default function StudyClinicResourceForm({
  draft,
  onChange,
  onSave,
  onStatus,
  busy,
  lockSection,
  saveLabel,
}: {
  draft: StudyClinicDraft;
  onChange: (next: Partial<StudyClinicDraft>) => void;
  onSave: () => void;
  onStatus?: (message: string) => void;
  busy: boolean;
  lockSection?: boolean;
  saveLabel?: string;
}) {
  const pickPdf = async (file: File | null) => {
    if (!file) return;
    const result = await uploadLessonPdf(file);
    if (!result.ok || !result.data) {
      onStatus?.(result.error || "Could not upload that PDF.");
      return;
    }
    onChange({ resourceUrl: result.data, kind: "pdf" });
    onStatus?.("PDF uploaded.");
  };

  return (
    <div className="rd-practice-form">
      <label>
        Type
        <select
          value={draft.kind}
          onChange={(event) => onChange({ kind: event.target.value as StudyClinicKind })}
        >
          {STUDY_CLINIC_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {studyClinicKindLabel(kind)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Title
        <input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} />
      </label>
      <label>
        Id
        <input value={draft.id} onChange={(event) => onChange({ id: event.target.value })} placeholder="auto from title" />
      </label>
      {lockSection ? null : (
        <label>
          Library
          <select
            value={draft.section}
            onChange={(event) => onChange({ section: inferStudyClinicSection({ section: event.target.value }) })}
          >
            {STUDY_CLINIC_SECTIONS.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Duration
        <input value={draft.duration} onChange={(event) => onChange({ duration: event.target.value })} placeholder="8 min" />
      </label>
      <label>
        Order
        <input value={draft.position} onChange={(event) => onChange({ position: event.target.value })} placeholder="1" />
      </label>
      <label className="rd-span">
        Blurb
        <textarea rows={3} value={draft.blurb} onChange={(event) => onChange({ blurb: event.target.value })} />
      </label>
      {draft.kind === "video" ? (
        <label className="rd-span">
          Video URLs
          <span className="muted small">One Vimeo or YouTube URL per line, in the order students should watch them.</span>
          <textarea
            rows={6}
            value={draft.videoUrlsText}
            onChange={(event) => onChange({ videoUrlsText: event.target.value })}
            placeholder="https://player.vimeo.com/video/123"
          />
        </label>
      ) : null}
      {draft.kind === "pdf" ? (
        <label className="rd-span">
          PDF
          <input
            type="url"
            value={draft.resourceUrl}
            onChange={(event) => onChange({ resourceUrl: event.target.value })}
            placeholder="https://…"
          />
          <input
            type="file"
            accept="application/pdf"
            onChange={(event) => {
              void pickPdf(event.target.files && event.target.files[0]);
              event.target.value = "";
            }}
          />
        </label>
      ) : null}
      {draft.kind === "link" ? (
        <>
          <label className="rd-span">
            Link URL
            <input
              type="url"
              value={draft.resourceUrl}
              onChange={(event) => onChange({ resourceUrl: event.target.value })}
              placeholder="https://…"
            />
          </label>
          <label>
            Link label
            <input
              value={draft.resourceLabel}
              onChange={(event) => onChange({ resourceLabel: event.target.value })}
              placeholder="Open worksheet"
            />
          </label>
        </>
      ) : null}
      <label className="rd-check">
        <input type="checkbox" checked={draft.published} onChange={(event) => onChange({ published: event.target.checked })} />
        Published to students
      </label>
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={onSave}>
          {busy ? "Saving…" : saveLabel || "Save Study Clinic resource"}
        </button>
      </div>
    </div>
  );
}
