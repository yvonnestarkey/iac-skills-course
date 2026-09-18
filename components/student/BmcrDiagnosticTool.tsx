"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  EMPTY_BMCR_MARKS,
  computeBmcrPct,
  fetchStudentBmcrEvaluations,
  formatPct,
  saveBmcrEvaluation,
  withDiagnostics,
  withQuestionTotal,
  type BmcrEvaluation,
  type BmcrValue,
} from "@/lib/bmcr";
import {
  EXAM_SITTINGS,
  findSitting,
  paperDisplayName,
  paperLabel,
  questionLabel,
  type ExamPaper,
  type ExamSitting,
} from "@/lib/exam-structure";
import { useStudentSession } from "@/lib/student-session";

type PaperDraft = {
  questions: Record<string, BmcrValue>;
  feels_needs_theory: boolean | null;
  feelings_reliable: boolean | null;
  notes: string;
};

type PaperStatus = { error?: string; saved?: string };

function diagnosticQuestionId(paperCode: string, questionCode: string): string {
  return `diagnostic:${paperCode}:${questionCode}`.toLowerCase();
}

function diagnosticPaperId(paperCode: string): string {
  return `diagnostic:${paperCode}`.toLowerCase();
}

function emptyQuestionBmcr(marks: number): BmcrValue {
  return withDiagnostics(
    withQuestionTotal({
      ...EMPTY_BMCR_MARKS,
      question_total_markplan: marks,
    })
  );
}

function emptyPaperDraft(paper: ExamPaper): PaperDraft {
  return {
    questions: Object.fromEntries(paper.questions.map((question) => [question.code, emptyQuestionBmcr(question.marks)])),
    feels_needs_theory: null,
    feelings_reliable: null,
    notes: "",
  };
}

function emptyAllDrafts(sitting: ExamSitting): Record<string, PaperDraft> {
  return Object.fromEntries(sitting.papers.map((paper) => [paper.id, emptyPaperDraft(paper)]));
}

function draftFromEvaluations(sitting: ExamSitting, rows: BmcrEvaluation[]): Record<string, PaperDraft> {
  const next = emptyAllDrafts(sitting);
  for (const paper of sitting.papers) {
    const paperRow = rows.find((row) => row.assignment_id === diagnosticPaperId(paper.code));
    const questions = { ...next[paper.id].questions };
    for (const question of paper.questions) {
      const saved = rows.find((row) => row.assignment_id === diagnosticQuestionId(paper.code, question.code));
      if (saved) questions[question.code] = withDiagnostics(saved);
    }
    next[paper.id] = {
      questions,
      feels_needs_theory: paperRow?.feels_needs_theory ?? null,
      feelings_reliable: paperRow?.feelings_reliable ?? null,
      notes: paperNotes(paperRow?.key_takeaways || "", paperDisplayName(sitting, paper)),
    };
  }
  return next;
}

function paperNotes(takeaways: string, paperName: string): string {
  if (!takeaways) return "";
  if (takeaways.startsWith(paperName)) return takeaways.slice(paperName.length).replace(/^\s+/, "");
  return takeaways;
}

function aggregatePaper(draft: PaperDraft): BmcrValue {
  const items = Object.values(draft.questions);
  const summed = withQuestionTotal({
    basic_my_marks: items.reduce((sum, item) => sum + item.basic_my_marks, 0),
    basic_markplan: items.reduce((sum, item) => sum + item.basic_markplan, 0),
    average_my_marks: items.reduce((sum, item) => sum + item.average_my_marks, 0),
    average_markplan: items.reduce((sum, item) => sum + item.average_markplan, 0),
    higher_my_marks: items.reduce((sum, item) => sum + item.higher_my_marks, 0),
    higher_markplan: items.reduce((sum, item) => sum + item.higher_markplan, 0),
    question_total_my_marks: 0,
    question_total_markplan: items.reduce((sum, item) => sum + item.question_total_markplan, 0),
  });
  return withDiagnostics({
    ...summed,
    feels_needs_theory: draft.feels_needs_theory,
    feelings_reliable: draft.feelings_reliable,
  });
}

export default function BmcrDiagnosticTool() {
  const { user } = useStudentSession();
  const defaultExam = EXAM_SITTINGS[0];
  const [examId, setExamId] = useState(defaultExam.id);
  const [drafts, setDrafts] = useState<Record<string, PaperDraft>>(() => emptyAllDrafts(defaultExam));
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, PaperStatus>>({});
  const [savedPapers, setSavedPapers] = useState<Record<string, boolean>>({});
  const [openIds, setOpenIds] = useState<Record<string, boolean>>(() => ({ [defaultExam.papers[0].id]: true }));

  const sitting = findSitting(examId) || defaultExam;

  useEffect(() => {
    if (!user?.id) return;
    fetchStudentBmcrEvaluations(user.id).then((rows) => {
      const diagnosticRows = rows.filter((row) => row.assignment_id.startsWith("diagnostic:"));
      setDrafts(draftFromEvaluations(sitting, diagnosticRows));
      const saved: Record<string, boolean> = {};
      for (const paper of sitting.papers) {
        saved[paper.id] = diagnosticRows.some((row) => row.assignment_id === diagnosticPaperId(paper.code));
      }
      setSavedPapers(saved);
    });
  }, [user?.id, sitting.id]);

  const setQuestionBmcr = (paperId: string, code: string, value: BmcrValue) => {
    setDrafts((prev) => ({
      ...prev,
      [paperId]: {
        ...(prev[paperId] || emptyPaperDraft(sitting.papers.find((item) => item.id === paperId) || sitting.papers[0])),
        questions: {
          ...(prev[paperId]?.questions || {}),
          [code]: value,
        },
      },
    }));
  };

  const patchPaper = (paperId: string, patch: Partial<PaperDraft>) => {
    setDrafts((prev) => ({
      ...prev,
      [paperId]: {
        ...(prev[paperId] || emptyPaperDraft(sitting.papers.find((item) => item.id === paperId) || sitting.papers[0])),
        ...patch,
      },
    }));
  };

  const savePaper = async (paper: ExamPaper) => {
    if (!user?.id) return;
    const draft = drafts[paper.id] || emptyPaperDraft(paper);
    for (const question of paper.questions) {
      const bmcr = draft.questions[question.code] || emptyQuestionBmcr(question.marks);
      if (bmcr.question_total_my_marks > question.marks || bmcr.question_total_markplan > question.marks) {
        setStatus((prev) => ({
          ...prev,
          [paper.id]: { error: `${question.code} is ${question.marks} marks. Entered marks cannot exceed that section total.` },
        }));
        return;
      }
    }
    if (draft.feels_needs_theory == null || draft.feelings_reliable == null) {
      setStatus((prev) => ({
        ...prev,
        [paper.id]: { error: `Answer the theory questions at the end of ${paper.title} before saving.` },
      }));
      return;
    }
    setBusyId(paper.id);
    setStatus((prev) => ({ ...prev, [paper.id]: {} }));
    const paperName = paperDisplayName(sitting, paper);
    for (const question of paper.questions) {
      const bmcr = draft.questions[question.code] || emptyQuestionBmcr(question.marks);
      const result = await saveBmcrEvaluation({
        studentId: user.id,
        assignmentId: diagnosticQuestionId(paper.code, question.code),
        marks: { ...bmcr, feels_needs_theory: null, feelings_reliable: null },
        key_takeaways: `${paperName} · ${questionLabel(question)}`,
      });
      if (!result.ok) {
        setBusyId(null);
        setStatus((prev) => ({ ...prev, [paper.id]: { error: result.error || "Could not save the BMCR." } }));
        return;
      }
    }
    const aggregated = aggregatePaper(draft);
    const paperResult = await saveBmcrEvaluation({
      studentId: user.id,
      assignmentId: diagnosticPaperId(paper.code),
      marks: aggregated,
      feels_needs_theory: draft.feels_needs_theory,
      feelings_reliable: draft.feelings_reliable,
      key_takeaways: [paperName, draft.notes.trim()].filter(Boolean).join("\n\n"),
    });
    setBusyId(null);
    if (!paperResult.ok) {
      setStatus((prev) => ({ ...prev, [paper.id]: { error: paperResult.error || "Could not save the BMCR." } }));
      return;
    }
    setSavedPapers((prev) => ({ ...prev, [paper.id]: true }));
    setStatus((prev) => ({
      ...prev,
      [paper.id]: { saved: `Saved ${paper.title}. BMCR conversion ${formatPct(computeBmcrPct(aggregated))}.` },
    }));
  };

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Pre-exam diagnostic</p>
      <h1>BMCR</h1>
      <p className="muted">
        Complete the calc table for every section in a paper. Interpretation and the theory questions sit at the end of that paper, then save.
      </p>
      {EXAM_SITTINGS.length > 1 ? (
        <label className="va-exam-select">
          Exam
          <select
            className="select-line"
            value={examId}
            onChange={(event) => {
              const next = findSitting(event.target.value) || defaultExam;
              setExamId(next.id);
              setDrafts(emptyAllDrafts(next));
              setStatus({});
              setOpenIds({ [next.papers[0].id]: true });
            }}
          >
            {EXAM_SITTINGS.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <div className="va-paper-stack">
        {sitting.papers.map((paper) => {
          const draft = drafts[paper.id] || emptyPaperDraft(paper);
          const paperStatus = status[paper.id] || {};
          const aggregated = aggregatePaper(draft);
          return (
            <details
              key={paper.id}
              className="va-paper-box"
              open={Boolean(openIds[paper.id])}
              onToggle={(event) => {
                const nextOpen = (event.currentTarget as HTMLDetailsElement).open;
                setOpenIds((prev) => (prev[paper.id] === nextOpen ? prev : { ...prev, [paper.id]: nextOpen }));
              }}
            >
              <summary>
                <span>
                  {paperLabel(paper)} · {paper.total_marks} marks
                </span>
                {savedPapers[paper.id] ? <span className="pill">Saved</span> : <span className="muted small">To do</span>}
              </summary>
              <form
                className="va-paper-body"
                onSubmit={(event) => {
                  event.preventDefault();
                  void savePaper(paper);
                }}
              >
                {paper.questions.map((question) => (
                  <section key={question.code} className="bmcr-question">
                    <h2>
                      {question.code} · {question.title}
                      <span className="muted small"> {question.marks} marks</span>
                    </h2>
                    <BmcrCalculator
                      value={draft.questions[question.code] || emptyQuestionBmcr(question.marks)}
                      onChange={(next) => setQuestionBmcr(paper.id, question.code, next)}
                      idPrefix={`bmcr-${paper.id}-${question.code}`}
                      maxMarks={question.marks}
                      showInterpretation={false}
                      showDiagnostics={false}
                    />
                  </section>
                ))}
                <section className="bmcr-paper-end">
                  <h2>Paper interpretation</h2>
                  <p className="muted">
                    These boxes use the totals from every section above. Answer the theory questions for {paper.title} as a whole.
                  </p>
                  <BmcrCalculator
                    value={aggregated}
                    onChange={(next) =>
                      patchPaper(paper.id, {
                        feels_needs_theory: next.feels_needs_theory ?? null,
                        feelings_reliable: next.feelings_reliable ?? null,
                      })
                    }
                    idPrefix={`bmcr-${paper.id}-paper`}
                    showTable={false}
                    showInterpretation
                    showDiagnostics
                  />
                  <label className="eval-notes">
                    Notes
                    <textarea
                      rows={3}
                      value={draft.notes}
                      onChange={(event) => patchPaper(paper.id, { notes: event.target.value })}
                      placeholder="What leaked across this paper?"
                    />
                  </label>
                </section>
                {paperStatus.error ? <p className="notice">{paperStatus.error}</p> : null}
                {paperStatus.saved ? <p className="waiting">{paperStatus.saved}</p> : null}
                <div className="actions">
                  <button className="primary" type="submit" disabled={busyId === paper.id || !user?.id}>
                    {busyId === paper.id ? "Saving…" : `Save ${paper.title}`}
                  </button>
                </div>
              </form>
            </details>
          );
        })}
      </div>
      <div className="actions va-continue">
        <Link href="/student/volume-accuracy" className="primary">
          Continue Script Evaluation
        </Link>
      </div>
    </article>
  );
}
