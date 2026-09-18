"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  EMPTY_BMCR_VALUE,
  computeBmcrPct,
  formatPct,
  saveBmcrEvaluation,
  withQuestionTotal,
  type BmcrValue,
} from "@/lib/bmcr";
import {
  EXAM_SITTINGS,
  findPaper,
  findQuestion,
  findSitting,
  paperDisplayName,
  paperLabel,
  questionLabel,
} from "@/lib/exam-structure";
import { useStudentSession } from "@/lib/student-session";

function diagnosticAssignmentId(paper: string, question: string): string {
  const slug = `${paper}:${question}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `diagnostic:${slug || "standalone"}`;
}

export default function BmcrDiagnosticTool() {
  const { user } = useStudentSession();
  const defaultExam = EXAM_SITTINGS[0];
  const defaultPaper = defaultExam.papers[0];
  const [examId, setExamId] = useState(defaultExam.id);
  const [paperId, setPaperId] = useState(defaultPaper.id);
  const [questionCode, setQuestionCode] = useState(defaultPaper.questions[0].code);
  const [notes, setNotes] = useState("");
  const [bmcr, setBmcr] = useState<BmcrValue>(
    withQuestionTotal({ ...EMPTY_BMCR_VALUE, question_total_markplan: defaultPaper.questions[0].marks })
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  const sitting = findSitting(examId) || defaultExam;
  const paper = findPaper(examId, paperId) || sitting.papers[0];
  const question = findQuestion(examId, paper.id, questionCode) || paper.questions[0];
  const paperName = paperDisplayName(sitting, paper);

  const cap = question.marks;
  const selectedLabel = useMemo(() => questionLabel(question), [question]);

  const applyQuestion = (code: string) => {
    const next = findQuestion(examId, paper.id, code) || paper.questions[0];
    setQuestionCode(next.code);
    setBmcr(withQuestionTotal({ ...EMPTY_BMCR_VALUE, question_total_markplan: next.marks }));
  };

  const changePaper = (nextPaperId: string, nextExamId = examId) => {
    const nextSitting = findSitting(nextExamId) || defaultExam;
    const nextPaper = findPaper(nextExamId, nextPaperId) || nextSitting.papers[0];
    const first = nextPaper.questions[0];
    setPaperId(nextPaper.id);
    setQuestionCode(first.code);
    setBmcr(withQuestionTotal({ ...EMPTY_BMCR_VALUE, question_total_markplan: first.marks }));
  };

  const submit = async () => {
    if (!user?.id) return;
    if (bmcr.question_total_my_marks > cap || bmcr.question_total_markplan > cap) {
      setError(`${question.code} is ${cap} marks. Entered marks cannot exceed that section total.`);
      return;
    }
    setBusy(true);
    setError("");
    setSaved("");
    const result = await saveBmcrEvaluation({
      studentId: user.id,
      assignmentId: diagnosticAssignmentId(paper.code, question.code),
      marks: bmcr,
      key_takeaways: [`${paperName} · ${selectedLabel}`, notes].filter(Boolean).join(" · "),
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error || "Could not save the BMCR.");
      return;
    }
    setSaved(`Saved. BMCR conversion ${formatPct(computeBmcrPct(bmcr))}.`);
  };

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Pre-exam diagnostic</p>
      <h1>BMCR</h1>
      <p className="muted">Basic Mark Capture Record. Choose a June 2026 IAC section, then categorize your marks. Inputs are capped at that section total.</p>
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
          Question
          <select className="select-line" value={question.code} onChange={(event) => applyQuestion(event.target.value)}>
            {paper.questions.map((item) => (
              <option key={item.code} value={item.code}>
                {questionLabel(item)}
              </option>
            ))}
          </select>
        </label>
        <BmcrCalculator value={bmcr} onChange={setBmcr} idPrefix="diag-bmcr" maxMarks={cap} />
        <label className="eval-notes">
          Notes
          <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What leaked on this question?" />
        </label>
        {error ? <p className="notice">{error}</p> : null}
        {saved ? <p className="waiting">{saved}</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !user?.id}>
            {busy ? "Saving…" : "Save BMCR"}
          </button>
        </div>
      </form>
    </article>
  );
}
