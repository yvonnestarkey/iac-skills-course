"use client";

import { useEffect, useState } from "react";
import { fetchOwnVolumeAccuracy, saveVolumeAccuracy, type VolumeAccuracyEntry } from "@/lib/volume-accuracy";
import { useStudentSession } from "@/lib/student-session";

const EMPTY = {
  paper_name: "",
  minutes_allowed: "",
  minutes_used: "",
  questions_available: "",
  questions_completed: "",
  marks_available: "",
  marks_earned: "",
  notes: "",
};

export default function VolumeAccuracyTool() {
  const { user } = useStudentSession();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<VolumeAccuracyEntry[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnVolumeAccuracy(user.id).then(setHistory);
  }, [user?.id]);

  const setField = (key: keyof typeof EMPTY, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submit = async () => {
    if (!user?.id) return;
    setBusy(true);
    setError("");
    const result = await saveVolumeAccuracy({
      userId: user.id,
      paper_name: form.paper_name.trim(),
      minutes_allowed: Number(form.minutes_allowed || 0),
      minutes_used: Number(form.minutes_used || 0),
      questions_available: Number(form.questions_available || 0),
      questions_completed: Number(form.questions_completed || 0),
      marks_available: Number(form.marks_available || 0),
      marks_earned: Number(form.marks_earned || 0),
      notes: form.notes.trim(),
    });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setHistory((prev) => [result.entry, ...prev].slice(0, 8));
    setForm(EMPTY);
  };

  return (
    <article className="lesson-body wide eval-page">
      <p className="kicker">Pre-exam diagnostic</p>
      <h1>Volume / Accuracy</h1>
      <p className="muted">Track your completion speed vs. accuracy under exam conditions.</p>
      <form
        className="eval-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <label>
          Paper or session
          <input type="text" value={form.paper_name} onChange={(event) => setField("paper_name", event.target.value)} placeholder="e.g. Timed Paper 1 attempt" required />
        </label>
        <fieldset className="eval-marks">
          <legend>Time</legend>
          <label>
            Minutes allowed
            <input type="number" min={0} step="1" value={form.minutes_allowed} onChange={(event) => setField("minutes_allowed", event.target.value)} required />
          </label>
          <label>
            Minutes used
            <input type="number" min={0} step="1" value={form.minutes_used} onChange={(event) => setField("minutes_used", event.target.value)} required />
          </label>
        </fieldset>
        <fieldset className="eval-marks">
          <legend>Volume</legend>
          <label>
            Questions available
            <input type="number" min={0} step="1" value={form.questions_available} onChange={(event) => setField("questions_available", event.target.value)} required />
          </label>
          <label>
            Questions completed
            <input type="number" min={0} step="1" value={form.questions_completed} onChange={(event) => setField("questions_completed", event.target.value)} required />
          </label>
        </fieldset>
        <fieldset className="eval-marks">
          <legend>Accuracy</legend>
          <label>
            Marks available
            <input type="number" min={0} step="0.5" value={form.marks_available} onChange={(event) => setField("marks_available", event.target.value)} required />
          </label>
          <label>
            Marks earned
            <input type="number" min={0} step="0.5" value={form.marks_earned} onChange={(event) => setField("marks_earned", event.target.value)} required />
          </label>
        </fieldset>
        <label className="eval-notes">
          Notes
          <textarea rows={3} value={form.notes} onChange={(event) => setField("notes", event.target.value)} placeholder="Where did time pressure or incomplete volume show up?" />
        </label>
        {error ? <p className="notice">{error}</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !user?.id}>
            {busy ? "Saving…" : "Save session"}
          </button>
        </div>
      </form>

      {history.length ? (
        <section className="eval-history">
          <h2>Saved sessions</h2>
          <ul>
            {history.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.paper_name || "Practice session"}</strong>
                  <span className="muted small">
                    Volume {row.volume_pct}% · Accuracy {row.accuracy_pct}% · Time {row.time_pct}%
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
