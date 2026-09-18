"use client";

import { useEffect, useMemo, useState } from "react";
import DiagnosticReportCard from "@/components/DiagnosticReportCard";
import { fetchOwnEvaluations, pct } from "@/lib/script-evaluation";
import type { DiagnosticReportResult } from "@/lib/diagnostic-report";
import { useStudentSession } from "@/lib/student-session";

type QuestionDraft = {
  question_code: string;
  tier1_earned: string;
  tier1_available: string;
  tier2_earned: string;
  tier2_available: string;
};

const EMPTY_QUESTION: QuestionDraft = {
  question_code: "",
  tier1_earned: "",
  tier1_available: "",
  tier2_earned: "",
  tier2_available: "",
};

export default function ScriptEvaluator() {
  const { user } = useStudentSession();
  const [paperName, setPaperName] = useState("");
  const [studentNotes, setStudentNotes] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([{ ...EMPTY_QUESTION }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DiagnosticReportResult | null>(null);
  const [history, setHistory] = useState<DiagnosticReportResult[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnEvaluations(user.id).then(setHistory);
  }, [user?.id]);

  const canSubmit = useMemo(() => {
    return Boolean(paperName.trim() && questions.some((question) => question.question_code.trim()) && !busy);
  }, [paperName, questions, busy]);

  const setQuestion = (index: number, key: keyof QuestionDraft, value: string) => {
    setQuestions((prev) => prev.map((question, i) => (i === index ? { ...question, [key]: value } : question)));
  };

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const payloadQuestions = questions
        .filter((question) => question.question_code.trim())
        .map((question) => ({
          question_code: question.question_code.trim(),
          tier1_earned: Number(question.tier1_earned || 0),
          tier1_available: Number(question.tier1_available || 0),
          tier2_earned: Number(question.tier2_earned || 0),
          tier2_available: Number(question.tier2_available || 0),
        }));
      const response = await fetch("/api/evaluate-script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paper_name: paperName.trim(),
          student_notes: studentNotes.trim(),
          questions: payloadQuestions,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || "Could not run the diagnostic.");
      }
      const next = payload as DiagnosticReportResult;
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
        Enter mark-sheet scores by question block. We split Tier 1 Knowledge (~35%) against Tier 2 Application (~65%) and retrieve matching examiner commentary.
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
            value={paperName}
            onChange={(event) => setPaperName(event.target.value)}
            placeholder="e.g. IAC Paper 1"
            required
          />
        </label>

        {questions.map((question, index) => (
          <fieldset key={index} className="eval-block">
            <legend>Question block {index + 1}</legend>
            <label>
              Question code
              <input
                type="text"
                value={question.question_code}
                onChange={(event) => setQuestion(index, "question_code", event.target.value)}
                placeholder="e.g. Q2.1"
                required={index === 0}
              />
            </label>
            <div className="eval-marks">
              <fieldset>
                <legend>Tier 1 Knowledge (~35%)</legend>
                <label>
                  Earned
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={question.tier1_earned}
                    onChange={(event) => setQuestion(index, "tier1_earned", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Available
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={question.tier1_available}
                    onChange={(event) => setQuestion(index, "tier1_available", event.target.value)}
                    required
                  />
                </label>
              </fieldset>
              <fieldset>
                <legend>Tier 2 Application (~65%)</legend>
                <label>
                  Earned
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={question.tier2_earned}
                    onChange={(event) => setQuestion(index, "tier2_earned", event.target.value)}
                    required
                  />
                </label>
                <label>
                  Available
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={question.tier2_available}
                    onChange={(event) => setQuestion(index, "tier2_available", event.target.value)}
                    required
                  />
                </label>
              </fieldset>
            </div>
            {questions.length > 1 ? (
              <button className="ghost" type="button" onClick={() => setQuestions((prev) => prev.filter((_, i) => i !== index))}>
                Remove block
              </button>
            ) : null}
          </fieldset>
        ))}

        <button className="ghost" type="button" onClick={() => setQuestions((prev) => [...prev, { ...EMPTY_QUESTION }])}>
          Add question block
        </button>

        <label className="eval-notes">
          Student notes
          <textarea
            rows={4}
            value={studentNotes}
            onChange={(event) => setStudentNotes(event.target.value)}
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

      {report ? <DiagnosticReportCard report={report} /> : null}

      {history.length ? (
        <section className="eval-history">
          <h2>Saved evaluations</h2>
          <ul>
            {history.map((row) => (
              <li key={row.id || row.question_code}>
                <button type="button" onClick={() => setReport(row)}>
                  <strong>
                    {row.paper_name} · {row.question_code}
                  </strong>
                  <span className="muted small">
                    Total {row.total_score_pct}% · Knowledge {pct(row.tier1_earned, row.tier1_available)}% · Application{" "}
                    {pct(row.tier2_earned, row.tier2_available)}%
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
