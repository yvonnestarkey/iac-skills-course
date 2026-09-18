"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  saveVolumeAccuracy,
  fetchOwnVolumeAccuracy,
  volumeRatios,
  type VolumeAccuracyEntry,
} from "@/lib/volume-accuracy";
import {
  EXAM_SITTINGS,
  findPaper,
  findQuestion,
  findSitting,
  paperLabel,
  questionLabel,
} from "@/lib/exam-structure";
import { useStudentSession } from "@/lib/student-session";

export default function VolumeAccuracyTool() {
  const { user } = useStudentSession();
  const defaultExam = EXAM_SITTINGS[0];
  const defaultPaper = defaultExam.papers[0];
  const [examId, setExamId] = useState(defaultExam.id);
  const [paperId, setPaperId] = useState(defaultPaper.id);
  const [questionCode, setQuestionCode] = useState(defaultPaper.questions[0].code);
  const [pointsAttempted, setPointsAttempted] = useState("");
  const [marksEarned, setMarksEarned] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<VolumeAccuracyEntry[]>([]);

  const sitting = findSitting(examId) || defaultExam;
  const paper = findPaper(examId, paperId) || sitting.papers[0];
  const question = findQuestion(examId, paper.id, questionCode) || paper.questions[0];
  const totalMarks = question.marks;

  const preview = useMemo(
    () => volumeRatios(Number(pointsAttempted || 0), totalMarks, Number(marksEarned || 0)),
    [pointsAttempted, totalMarks, marksEarned]
  );

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnVolumeAccuracy(user.id).then(setHistory);
  }, [user?.id]);

  const applyQuestion = (code: string) => {
    const next = findQuestion(examId, paper.id, code) || paper.questions[0];
    setQuestionCode(next.code);
  };

  const changePaper = (nextPaperId: string, nextExamId = examId) => {
    const nextSitting = findSitting(nextExamId) || defaultExam;
    const nextPaper = findPaper(nextExamId, nextPaperId) || nextSitting.papers[0];
    const first = nextPaper.questions[0];
    setPaperId(nextPaper.id);
    setQuestionCode(first.code);
  };

  const submit = async () => {
    if (!user?.id) return;
    const attempted = Number(pointsAttempted || 0);
    const earned = Number(marksEarned || 0);
    if (earned > totalMarks) {
      setError(`${question.code} is ${totalMarks} total marks. Marks earned cannot exceed that section allocation.`);
      return;
    }
    setBusy(true);
    setError("");
    const result = await saveVolumeAccuracy({
      userId: user.id,
      question_code: question.code,
      paper_name: `${question.code} · ${question.title}`,
      total_marks: totalMarks,
      points_attempted: attempted,
      marks_earned: earned,
      notes: notes.trim(),
    });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setHistory((prev) => [result.entry, ...prev].slice(0, 8));
    setPointsAttempted("");
    setMarksEarned("");
    setNotes("");
  };

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Pre-exam diagnostic</p>
      <h1>Volume vs Accuracy</h1>
      <p className="muted">
        Total Marks is the official capped allocation for the section (for example 33 for Beita Risks). Volume, accuracy, and score conversion are calculated from the points you wrote and the marks awarded.
      </p>
      <form
        className="eval-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
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
        <label>
          Question Code
          <select className="select-line" value={question.code} onChange={(event) => applyQuestion(event.target.value)}>
            {paper.questions.map((item) => (
              <option key={item.code} value={item.code}>
                {questionLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Total Marks
          <input type="number" value={totalMarks} readOnly />
        </label>
        <fieldset className="eval-marks">
          <legend>Attempt</legend>
          <label>
            Points Attempted
            <input
              type="number"
              min={0}
              step="1"
              value={pointsAttempted}
              onChange={(event) => setPointsAttempted(event.target.value)}
              required
            />
          </label>
          <label>
            Marks Earned
            <input
              type="number"
              min={0}
              max={totalMarks}
              step="0.5"
              value={marksEarned}
              onChange={(event) => setMarksEarned(event.target.value)}
              required
            />
          </label>
        </fieldset>
        <p className="muted small">
          Volume Ratio {preview.volume_pct}% · Accuracy Ratio {preview.accuracy_pct}% · Score Conversion {preview.score_conversion_pct}%
        </p>
        {preview.message ? <p className="notice">{preview.message}</p> : null}
        <label className="eval-notes">
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Where did incomplete volume or weak point accuracy show up?"
          />
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
                  <strong>{row.paper_name || row.question_code || "Practice session"}</strong>
                  <span className="muted small">
                    Volume {row.volume_pct}% · Accuracy {row.accuracy_pct}% · Conversion {row.score_conversion_pct}%
                  </span>
                  {row.diagnostic ? <p>{row.diagnostic}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </article>
  );
}
