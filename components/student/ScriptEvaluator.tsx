"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchOwnEvaluations,
  pct,
  type ScriptEvaluationRecord,
  type ScriptEvaluationResult,
} from "@/lib/script-evaluation";
import { useStudentSession } from "@/lib/student-session";

const EMPTY = {
  paper_name: "",
  question_code: "",
  tier1_earned: "",
  tier1_available: "",
  tier2_earned: "",
  tier2_available: "",
  student_notes: "",
};

function ScoreBar({ label, earned, available, hint }: { label: string; earned: number; available: number; hint: string }) {
  const value = pct(earned, available);
  return (
    <div className="eval-score">
      <div className="eval-score-head">
        <strong>{label}</strong>
        <span>
          {earned} / {available} · {value}%
        </span>
      </div>
      <p className="muted small">{hint}</p>
      <div className="student-progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <span style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Report({ report }: { report: ScriptEvaluationResult }) {
  return (
    <section className="eval-report" aria-live="polite">
      <p className="kicker">Diagnostic report</p>
      <h2>
        {report.paper_name} · {report.question_code}
      </h2>
      <div className="eval-scores">
        <ScoreBar
          label="Tier 1 Knowledge"
          earned={report.tier1_earned}
          available={report.tier1_available}
          hint="~35% of the paper — definitions, principles, and technical recall."
        />
        <ScoreBar
          label="Tier 2 Application"
          earned={report.tier2_earned}
          available={report.tier2_available}
          hint="~65% of the paper — using the facts, format, and a justified conclusion."
        />
      </div>
      <div className="eval-grid">
        <article>
          <h3>Knowledge summary</h3>
          <p>{report.knowledge_summary}</p>
        </article>
        <article>
          <h3>Application summary</h3>
          <p>{report.application_summary}</p>
        </article>
      </div>
      {report.dropped_marks_breakdown.length ? (
        <div className="eval-drops">
          <h3>Dropped marks</h3>
          <ul>
            {report.dropped_marks_breakdown.map((row, index) => (
              <li key={`${row.area}-${index}`}>
                <strong>{row.area}</strong>
                {row.likely_loss ? <span className="muted small">{row.likely_loss}</span> : null}
                <p>{row.examiner_note}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="eval-steps">
        <h3>Coaching recommendation</h3>
        <ol>
          {report.coaching_recommendation.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default function ScriptEvaluator() {
  const { user } = useStudentSession();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ScriptEvaluationResult | null>(null);
  const [history, setHistory] = useState<ScriptEvaluationRecord[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnEvaluations(user.id).then(setHistory);
  }, [user?.id]);

  const canSubmit = useMemo(() => {
    return Boolean(form.paper_name.trim() && form.question_code.trim() && !busy);
  }, [form.paper_name, form.question_code, busy]);

  const setField = (key: keyof typeof EMPTY, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/evaluate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_name: form.paper_name.trim(),
          question_code: form.question_code.trim(),
          tier1_earned: Number(form.tier1_earned || 0),
          tier1_available: Number(form.tier1_available || 0),
          tier2_earned: Number(form.tier2_earned || 0),
          tier2_available: Number(form.tier2_available || 0),
          student_notes: form.student_notes.trim(),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not run the diagnostic.");
      }
      const next = payload as ScriptEvaluationResult;
      setReport(next);
      setHistory((prev) => [next, ...prev.filter((row) => row.id !== next.id)].slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run the diagnostic.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="lesson-body wide eval-page">
      <p className="kicker">AI diagnostic engine</p>
      <h1>Script evaluator</h1>
      <p className="muted">
        Enter your mark-sheet scores. We compare Tier 1 Knowledge (~35%) against Tier 2 Application (~65%) and retrieve matching examiner commentary.
      </p>

      <form
        className="eval-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void run();
        }}
      >
        <label>
          Paper name
          <input
            type="text"
            value={form.paper_name}
            onChange={(event) => setField("paper_name", event.target.value)}
            placeholder="e.g. IAC Paper 1"
            required
          />
        </label>
        <label>
          Question code
          <input
            type="text"
            value={form.question_code}
            onChange={(event) => setField("question_code", event.target.value)}
            placeholder="e.g. Q2.1"
            required
          />
        </label>
        <fieldset className="eval-marks">
          <legend>Tier 1 Knowledge (~35%)</legend>
          <label>
            Earned
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.tier1_earned}
              onChange={(event) => setField("tier1_earned", event.target.value)}
              required
            />
          </label>
          <label>
            Available
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.tier1_available}
              onChange={(event) => setField("tier1_available", event.target.value)}
              required
            />
          </label>
        </fieldset>
        <fieldset className="eval-marks">
          <legend>Tier 2 Application (~65%)</legend>
          <label>
            Earned
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.tier2_earned}
              onChange={(event) => setField("tier2_earned", event.target.value)}
              required
            />
          </label>
          <label>
            Available
            <input
              type="number"
              min={0}
              step="0.5"
              value={form.tier2_available}
              onChange={(event) => setField("tier2_available", event.target.value)}
              required
            />
          </label>
        </fieldset>
        <label className="eval-notes">
          Student notes
          <textarea
            rows={4}
            value={form.student_notes}
            onChange={(event) => setField("student_notes", event.target.value)}
            placeholder="What did the required ask? Where did you feel the script ran out of structure?"
          />
        </label>
        {error ? <p className="notice">{error}</p> : null}
        {busy ? <p className="waiting">Comparing against IAC Examiner Frameworks...</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={!canSubmit}>
            {busy ? "Evaluating…" : "Run diagnostic"}
          </button>
        </div>
      </form>

      {report ? <Report report={report} /> : null}

      {history.length ? (
        <section className="eval-history">
          <h2>Saved evaluations</h2>
          <ul>
            {history.map((row) => (
              <li key={row.id}>
                <button type="button" onClick={() => setReport(row)}>
                  <strong>
                    {row.paper_name} · {row.question_code}
                  </strong>
                  <span className="muted small">
                    Knowledge {pct(row.tier1_earned, row.tier1_available)}% · Application {pct(row.tier2_earned, row.tier2_available)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
