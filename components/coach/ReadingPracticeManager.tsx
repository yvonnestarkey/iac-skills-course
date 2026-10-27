"use client";

import { useEffect, useState } from "react";
import { EXERCISES } from "@/lib/reading-drills";
import {
  draftFromExercise,
  emptyPracticeDraft,
  exerciseFromDraft,
  PRACTICE_DRAFT_HELP,
  type PracticeExerciseDraft,
  type PracticeExerciseRow,
} from "@/lib/reading-practice";

export default function ReadingPracticeManager() {
  const [rows, setRows] = useState<PracticeExerciseRow[]>([]);
  const [draft, setDraft] = useState<PracticeExerciseDraft>(emptyPracticeDraft());
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch("/api/coach/reading-exercises");
    const payload = await response.json().catch(() => ({}));
    if (response.ok) setRows(payload.exercises || []);
    else setStatus(payload.error || "Could not load practice questions.");
  };

  useEffect(() => {
    void load();
  }, []);

  const set = (next: Partial<PracticeExerciseDraft>) => setDraft((current) => ({ ...current, ...next }));

  const save = async () => {
    const parsed = exerciseFromDraft(draft);
    if (!parsed.exercise) {
      setStatus(parsed.error || "Fix the question before saving.");
      return;
    }
    setBusy(true);
    setStatus("");
    const response = await fetch("/api/coach/reading-exercises", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, id: parsed.exercise.id }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setStatus(payload.error || "Could not save.");
      return;
    }
    setDraft(draftFromExercise(payload.exercise, draft.published));
    setStatus("Saved to the Reading & RTFQ practice bank.");
    await load();
  };

  const remove = async (id: string) => {
    const builtIn = EXERCISES.some((exercise) => exercise.id === id);
    if (!window.confirm(builtIn ? "Restore the built-in version of this question?" : "Remove this practice question from the student hub?")) return;
    setBusy(true);
    const response = await fetch(`/api/coach/reading-exercises/${encodeURIComponent(id)}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatus(payload.error || "Could not delete.");
      return;
    }
    if (draft.id === id) setDraft(emptyPracticeDraft());
    await load();
  };

  const savedIds = new Set(rows.map((row) => row.id));
  const builtInRows: PracticeExerciseRow[] = EXERCISES.map((exercise, index) => {
    const saved = rows.find((row) => row.id === exercise.id);
    return saved || {
      id: exercise.id,
      title: exercise.title,
      area: exercise.area,
      published: true,
      position: index,
      payload: exercise,
    };
  });
  const extraRows = rows.filter((row) => !EXERCISES.some((exercise) => exercise.id === row.id));

  return (
    <div className="rd-practice-admin">
      <p className="muted small">
        Edit the Reading & RTFQ question bank. Built-in drills stay available in Task 2 lessons. Saved changes and new
        questions appear on the student dashboard hub after Task 2.
      </p>
      {status ? <p className="notice">{status}</p> : null}

      <div className="rd-practice-list">
        {[...builtInRows, ...extraRows].map((row) => {
          const builtIn = EXERCISES.some((exercise) => exercise.id === row.id);
          const edited = builtIn && savedIds.has(row.id);
          return (
            <div key={row.id} className="rd-sheet rd-row">
              <div>
                <b>{row.title}</b>
                <div className="muted small">
                  {row.area} · {row.id}
                  {builtIn ? (edited ? " · built-in, edited" : " · built-in") : " · extra"}
                  {row.published ? "" : " · hidden"}
                </div>
              </div>
              <div className="actions">
                <button type="button" className="ghost" onClick={() => setDraft(draftFromExercise(row.payload, row.published))}>
                  Edit
                </button>
                {savedIds.has(row.id) ? (
                  <button type="button" className="ghost" disabled={busy} onClick={() => void remove(row.id)}>
                    {edited ? "Restore" : "Delete"}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
        <button type="button" className="ghost" onClick={() => setDraft(emptyPracticeDraft())}>
          New question
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
          Area
          <input value={draft.area} onChange={(event) => set({ area: event.target.value })} />
        </label>
        <label>
          Marks
          <input value={draft.marks} onChange={(event) => set({ marks: event.target.value })} />
        </label>
        <label>
          Answer minutes
          <input value={draft.answer_minutes} onChange={(event) => set({ answer_minutes: event.target.value })} />
        </label>
        <label>
          Skills trained
          <input value={draft.trains} onChange={(event) => set({ trains: event.target.value })} />
        </label>
        <label className="rd-span">
          Required
          <textarea rows={3} value={draft.required} onChange={(event) => set({ required: event.target.value })} />
        </label>
        <label className="rd-span">
          Case
          <span className="muted small">{PRACTICE_DRAFT_HELP.caseText}</span>
          <textarea rows={8} value={draft.caseText} onChange={(event) => set({ caseText: event.target.value })} />
        </label>
        <label className="rd-span">
          Recall questions
          <span className="muted small">{PRACTICE_DRAFT_HELP.recallText}</span>
          <textarea rows={6} value={draft.recallText} onChange={(event) => set({ recallText: event.target.value })} />
        </label>
        <label className="rd-span">
          RTFQ Shape
          <span className="muted small">{PRACTICE_DRAFT_HELP.shapeText}</span>
          <textarea rows={4} value={draft.shapeText} onChange={(event) => set({ shapeText: event.target.value })} />
          <input placeholder="Why this shape" value={draft.shapeWhy} onChange={(event) => set({ shapeWhy: event.target.value })} />
        </label>
        <label className="rd-span">
          RTFQ Directions
          <span className="muted small">{PRACTICE_DRAFT_HELP.directionsText}</span>
          <textarea rows={4} value={draft.directionsText} onChange={(event) => set({ directionsText: event.target.value })} />
          <input placeholder="Why these directions" value={draft.dirWhy} onChange={(event) => set({ dirWhy: event.target.value })} />
        </label>
        <label className="rd-span">
          RTFQ Lens
          <span className="muted small">{PRACTICE_DRAFT_HELP.lensText}</span>
          <textarea rows={4} value={draft.lensText} onChange={(event) => set({ lensText: event.target.value })} />
          <input placeholder="Why this lens" value={draft.lensWhy} onChange={(event) => set({ lensWhy: event.target.value })} />
        </label>
        <label className="rd-span">
          Mark rows
          <span className="muted small">{PRACTICE_DRAFT_HELP.rowsText}</span>
          <textarea rows={6} value={draft.rowsText} onChange={(event) => set({ rowsText: event.target.value })} />
        </label>
        <label className="rd-check">
          <input type="checkbox" checked={draft.published} onChange={(event) => set({ published: event.target.checked })} />
          Published to students
        </label>
        <div className="actions">
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Saving…" : "Save practice question"}
          </button>
        </div>
      </div>
    </div>
  );
}
