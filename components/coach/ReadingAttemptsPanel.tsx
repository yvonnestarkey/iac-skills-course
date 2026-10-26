"use client";

import { useEffect, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";
import { getExercise, READING_CHECK, type DrillAttempt, type ReadingCheckResult } from "@/lib/reading-drills";
import { listCoachReadingHistory, resetCoachReadingTask } from "@/lib/reading-drills-store";

export default function ReadingAttemptsPanel({ studentId }: { studentId: string }) {
  const [attempts, setAttempts] = useState<DrillAttempt[]>([]);
  const [checks, setChecks] = useState<ReadingCheckResult[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [ready, setReady] = useState(false);

  const load = async () => {
    const result = await listCoachReadingHistory(studentId);
    setAttempts(result.attempts);
    setChecks(result.checks);
    setError(result.error || "");
    setReady(true);
  };

  useEffect(() => {
    void load();
  }, [studentId]);

  const reset = async (kind: "exercise" | "check", key: string, label: string) => {
    if (!window.confirm(`Reset “${label}”? The score is removed and they can do this task once more.`)) return;
    setBusy(`${kind}:${key}`);
    const result = await resetCoachReadingTask({ studentId, kind, key });
    setBusy("");
    if (!result.ok) {
      setError(result.error || "Could not reset that reading task.");
      return;
    }
    await load();
  };

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Reading tasks</h2>
          <p className="muted small">One attempt each. Reset if they mess up the process and message you.</p>
        </div>
      </div>
      {error ? <p className="waiting">{error}</p> : null}
      {!ready ? <p className="empty">Loading reading scores…</p> : null}
      {ready && !checks.length && !attempts.length ? <p className="empty">No reading tasks completed yet.</p> : null}

      {checks.map((check) => (
        <div className="work-item" key={check.id || check.check_id}>
          <div className="work-head">
            <strong>Reading check · {check.profile || READING_CHECK.title}</strong>
            <span className="muted small">{check.created_at ? formatSastDateTime(check.created_at) : ""}</span>
          </div>
          <p className="muted small">
            {check.wpm} words a minute · absorbed {check.absorb} of {check.absorb_n} · {check.notes} notes
          </p>
          <div className="actions">
            <button
              className="ghost"
              type="button"
              disabled={busy === `check:${check.check_id}`}
              onClick={() => void reset("check", check.check_id, "Reading check")}
            >
              {busy === `check:${check.check_id}` ? "Resetting…" : "Reset attempt"}
            </button>
          </div>
        </div>
      ))}

      {attempts.map((attempt) => {
        const exercise = getExercise(attempt.exercise_id);
        const title = exercise ? `${exercise.title} · ${exercise.area}` : attempt.exercise_id;
        const key = `exercise:${attempt.exercise_id}`;
        return (
          <div className="work-item" key={attempt.id || attempt.exercise_id}>
            <div className="work-head">
              <strong>{title}</strong>
              <span className="muted small">
                {typeof attempt.grade?.pct === "number" ? `${attempt.grade.pct}%` : "Done"}
                {attempt.created_at ? ` · ${formatSastDateTime(attempt.created_at)}` : ""}
              </span>
            </div>
            <p className="muted small">
              {attempt.wpm} wpm · absorbed {attempt.recall} of {attempt.recall_n}
              {attempt.signals?.length ? ` · ${attempt.signals.join(" · ")}` : ""}
              {attempt.marked_by === "model" ? " · marked automatically" : " · self-marked"}
            </p>
            <div className="actions">
              <button
                className="ghost"
                type="button"
                disabled={busy === key}
                onClick={() => void reset("exercise", attempt.exercise_id, title)}
              >
                {busy === key ? "Resetting…" : "Reset attempt"}
              </button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
