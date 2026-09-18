"use client";

import { useEffect, useMemo, useState } from "react";
import DiagnosticReportCard from "@/components/DiagnosticReportCard";
import { fetchOwnEvaluations, pct } from "@/lib/script-evaluation";
import type { DiagnosticReportResult } from "@/lib/diagnostic-report";
import {
  EXAM_SITTINGS,
  findPaper,
  findQuestion,
  findSitting,
  paperDisplayName,
  paperLabel,
  questionLabel,
  splitSectionMarks,
} from "@/lib/exam-structure";
import { useStudentSession } from "@/lib/student-session";

type QuestionDraft = {
  question_code: string;
  tier1_earned: string;
  tier1_available: string;
  tier2_earned: string;
  tier2_available: string;
};

function draftFromQuestion(code: string, marks: number): QuestionDraft {
  const split = splitSectionMarks(marks);
  return {
    question_code: code,
    tier1_earned: "",
    tier1_available: String(split.knowledge),
    tier2_earned: "",
    tier2_available: String(split.application),
  };
}

export default function ScriptEvaluator() {
  const { user } = useStudentSession();
  const defaultExam = EXAM_SITTINGS[0];
  const defaultPaper = defaultExam.papers[0];
  const [examId, setExamId] = useState(defaultExam.id);
  const [paperId, setPaperId] = useState(defaultPaper.id);
  const [studentNotes, setStudentNotes] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([
    draftFromQuestion(defaultPaper.questions[0].code, defaultPaper.questions[0].marks),
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<DiagnosticReportResult | null>(null);
  const [history, setHistory] = useState<DiagnosticReportResult[]>([]);

  const sitting = findSitting(examId) || defaultExam;
  const paper = findPaper(examId, paperId) || sitting.papers[0];
  const paperName = paperDisplayName(sitting, paper);

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnEvaluations(user.id).then(setHistory);
  }, [user?.id]);

  const canSubmit = useMemo(() => {
    return Boolean(paperName && questions.some((question) => question.question_code.trim()) && !busy);
  }, [paperName, questions, busy]);

  const setQuestion = (index: number, key: keyof QuestionDraft, value: string) => {
    setQuestions((prev) =>
      prev.map((question, i) => {
        if (i !== index) return question;
        if (key === "question_code") {
          const mapped = findQuestion(examId, paper.id, value);
          return mapped ? draftFromQuestion(mapped.code, mapped.marks) : { ...question, question_code: value };
        }
        const mapped = findQuestion(examId, paper.id, question.question_code);
        const cap = mapped?.marks;
        const numeric = Number(value);
        const nextValue = cap != null && Number.isFinite(numeric) ? String(Math.min(numeric, cap)) : value;
        return { ...question, [key]: nextValue };
      })
    );
  };

  const changePaper = (nextPaperId: string, nextExamId = examId) => {
    const nextSitting = findSitting(nextExamId) || defaultExam;
    const nextPaper = findPaper(nextExamId, nextPaperId) || nextSitting.papers[0];
    const first = nextPaper.questions[0];
    setPaperId(nextPaper.id);
    setQuestions([draftFromQuestion(first.code, first.marks)]);
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
          paper_name: paperName,
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
        Select the June 2026 IAC paper and question. Available marks are capped at that section total and split Tier 1 Knowledge (~35%) vs Tier 2 Application (~65%).
      </p>

      <form
        className="eval-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canSubmit) void run();
        }}
      >
        <label>
          Exam
          <select
            className="select-line"
            value={examId}
            onChange={(event) => {
              const next = findSitting(event.target.value) || defaultExam;
              const firstPaper = next.papers[0];
              setExamId(next.id);
              changePaper(firstPaper.id, next.id);
            }}
          >
            {EXAM_SITTINGS.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paper
          <select className="select-line" value={paper.id} onChange={(event) => changePaper(event.target.value)}>
            {sitting.papers.map((item) => (
              <option key={item.id} value={item.id}>
                {paperLabel(item)} · {item.total_marks} marks
              </option>
            ))}
          </select>
        </label>

        {questions.map((question, index) => {
          const mapped = findQuestion(examId, paper.id, question.question_code);
          const cap = mapped?.marks;
          return (
            <fieldset key={index} className="eval-block">
              <legend>Question block {index + 1}</legend>
              <label>
                Question
                <select
                  className="select-line"
                  value={question.question_code}
                  onChange={(event) => setQuestion(index, "question_code", event.target.value)}
                  required={index === 0}
                >
                  {paper.questions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {questionLabel(item)}
                    </option>
                  ))}
                </select>
              </label>
              {cap != null ? <p className="muted small">Section total: {cap} marks</p> : null}
              <div className="eval-marks">
                <fieldset>
                  <legend>Tier 1 Knowledge (~35%)</legend>
                  <label>
                    Earned
                    <input
                      type="number"
                      min={0}
                      max={Number(question.tier1_available || cap || undefined)}
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
                      max={cap}
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
                      max={Number(question.tier2_available || cap || undefined)}
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
                      max={cap}
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
          );
        })}

        <button
          className="ghost"
          type="button"
          onClick={() => {
            const unused = paper.questions.find((item) => !questions.some((row) => row.question_code === item.code)) || paper.questions[0];
            setQuestions((prev) => [...prev, draftFromQuestion(unused.code, unused.marks)]);
          }}
        >
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
