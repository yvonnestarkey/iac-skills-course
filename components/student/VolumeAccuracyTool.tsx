"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  CALCULATION_TAG,
  diagnosticTag,
  fetchOwnVolumeSessions,
  saveVolumePaperSession,
  volumeRatios,
  type VolumePaperSession,
} from "@/lib/volume-accuracy";
import EvaluatorExamPicker from "@/components/student/EvaluatorExamPicker";
import { isCalculationQuestion, paperDisplayName, paperLabel, type ExamPaper, type ExamQuestion, type ExamSitting } from "@/lib/exam-structure";
import { useEvaluatorExam } from "@/lib/use-evaluator-exam";
import { useStudentSession } from "@/lib/student-session";

type Draft = { points: string; marks: string };
type DraftMap = Record<string, Draft>;
type PaperStatus = { error?: string; saved?: string };

function emptyDrafts(paper: ExamPaper): DraftMap {
  return Object.fromEntries(paper.questions.map((question) => [question.code, { points: "", marks: "" }]));
}

function emptyAllDrafts(sitting: ExamSitting): DraftMap {
  return Object.assign({}, ...sitting.papers.map(emptyDrafts)) as DraftMap;
}

function draftsFromSession(paper: ExamPaper, session: VolumePaperSession | undefined): DraftMap {
  const next = emptyDrafts(paper);
  if (!session) return next;
  for (const row of session.questions) {
    if (!next[row.question_code]) continue;
    next[row.question_code] = {
      points: row.isCalculation ? "" : String(row.points_wrote),
      marks: String(row.marks_got),
    };
  }
  return next;
}

function draftsFromSessions(sitting: ExamSitting, sessions: VolumePaperSession[]): DraftMap {
  return sitting.papers.reduce<DraftMap>(
    (acc, paper) => ({
      ...acc,
      ...draftsFromSession(
        paper,
        sessions.find((session) => session.paper_code === paper.code)
      ),
    }),
    {}
  );
}

function livePreview(question: ExamQuestion, draft: Draft) {
  const calc = isCalculationQuestion(question);
  if (calc) {
    return {
      volume: "N/A",
      accuracy: "N/A",
      tag: draft.marks === "" ? "" : CALCULATION_TAG,
    };
  }
  if (draft.points === "" || draft.marks === "") {
    return { volume: "—", accuracy: "—", tag: "" };
  }
  const ratios = volumeRatios(Number(draft.points || 0), question.marks, Number(draft.marks || 0), false);
  return {
    volume: `${ratios.volume_pct}%`,
    accuracy: `${ratios.accuracy_pct}%`,
    tag: diagnosticTag(ratios.kind),
  };
}

export default function VolumeAccuracyTool() {
  const { user } = useStudentSession();
  const { exam, href } = useEvaluatorExam();
  const sitting = exam;
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, PaperStatus>>({});
  const [sessions, setSessions] = useState<VolumePaperSession[]>([]);
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!sitting) {
      setDrafts({});
      setOpenIds({});
      setStatus({});
      return;
    }
    setDrafts(emptyAllDrafts(sitting));
    setStatus({});
    setOpenIds({ [sitting.papers[0].id]: true });
    if (!user?.id) return;
    fetchOwnVolumeSessions(user.id).then((next) => {
      setSessions(next);
      setDrafts(draftsFromSessions(sitting, next));
    });
  }, [user?.id, sitting]);

  const setDraft = (code: string, key: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...(prev[code] || { points: "", marks: "" }), [key]: value } }));
  };

  const savePaper = async (paper: ExamPaper) => {
    if (!user?.id || !sitting) return;
    const rows = [];
    for (const question of paper.questions) {
      const draft = drafts[question.code] || { points: "", marks: "" };
      const calc = isCalculationQuestion(question);
      if (draft.marks === "") {
        setStatus((prev) => ({ ...prev, [paper.id]: { error: `Enter Marks You Got for ${question.code}.` } }));
        return;
      }
      if (!calc && draft.points === "") {
        setStatus((prev) => ({ ...prev, [paper.id]: { error: `Enter Points Wrote for ${question.code}.` } }));
        return;
      }
      const marksGot = Number(draft.marks);
      if (marksGot > question.marks) {
        setStatus((prev) => ({
          ...prev,
          [paper.id]: { error: `${question.code} is ${question.marks} total marks. Marks You Got cannot exceed that ceiling.` },
        }));
        return;
      }
      rows.push({
        question_code: question.code,
        title: question.title,
        total_marks: question.marks,
        isCalculation: calc,
        points_wrote: calc ? 0 : Number(draft.points),
        marks_got: marksGot,
      });
    }
    setBusyId(paper.id);
    setStatus((prev) => ({ ...prev, [paper.id]: {} }));
    const result = await saveVolumePaperSession({
      userId: user.id,
      paper_code: paper.code,
      paper_name: paperDisplayName(sitting, paper),
      rows,
    });
    setBusyId(null);
    if (result.ok === false) {
      setStatus((prev) => ({ ...prev, [paper.id]: { error: result.error } }));
      return;
    }
    setSessions((prev) => [result.session, ...prev.filter((session) => session.session_id !== result.session.session_id)].slice(0, 12));
    setStatus((prev) => ({ ...prev, [paper.id]: { saved: `Saved ${paper.title}.` } }));
  };

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href={href("/student/evaluator")}>← Script evaluator</Link>
      </p>
      <p className="kicker">Pre-exam diagnostic</p>
      <h1>Volume vs Accuracy</h1>
      <p className="muted">
        Complete each paper in its own box. Collapse papers you are not working on. Points Wrote is N/A on calculation/disclosure questions so those rows do not skew volume.
      </p>
      <EvaluatorExamPicker />
      {!sitting ? (
        <p className="notice">Select an exam to load the Volume vs Accuracy tables for that sitting.</p>
      ) : null}

      <div className="va-paper-stack" key={sitting?.id || "none"}>
        {(sitting?.papers || []).map((paper) => {
          const savedSession = sessions.find((session) => session.paper_code === paper.code);
          const paperStatus = status[paper.id] || {};
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
                {savedSession ? <span className="pill">Saved</span> : <span className="muted small">To do</span>}
              </summary>
              <form
                className="va-paper-body"
                onSubmit={(event) => {
                  event.preventDefault();
                  void savePaper(paper);
                }}
              >
                <div className="va-table-wrap">
                  <table className="va-table">
                    <thead>
                      <tr>
                        <th scope="col">Question Code &amp; Title</th>
                        <th scope="col">Total Marks</th>
                        <th scope="col">Points Wrote</th>
                        <th scope="col">Marks You Got</th>
                        <th scope="col">Volume %</th>
                        <th scope="col">Accuracy %</th>
                        <th scope="col">Diagnostic Tag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paper.questions.map((question) => {
                        const draft = drafts[question.code] || { points: "", marks: "" };
                        const calc = isCalculationQuestion(question);
                        const preview = livePreview(question, draft);
                        return (
                          <tr key={question.code} className={calc ? "va-calc" : undefined}>
                            <th scope="row">
                              <strong>{question.code}</strong>
                              <span className="muted small">{question.title}</span>
                            </th>
                            <td>{question.marks}</td>
                            <td>
                              {calc ? (
                                <span className="va-na">N/A</span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  step="1"
                                  value={draft.points}
                                  onChange={(event) => setDraft(question.code, "points", event.target.value)}
                                  aria-label={`${question.code} Points Wrote`}
                                />
                              )}
                            </td>
                            <td>
                              <input
                                type="number"
                                min={0}
                                max={question.marks}
                                step="0.5"
                                value={draft.marks}
                                onChange={(event) => setDraft(question.code, "marks", event.target.value)}
                                aria-label={`${question.code} Marks You Got`}
                              />
                            </td>
                            <td>{preview.volume}</td>
                            <td>{preview.accuracy}</td>
                            <td>{preview.tag || "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {paperStatus.error ? <p className="notice">{paperStatus.error}</p> : null}
                {paperStatus.saved ? <p className="muted">{paperStatus.saved}</p> : null}
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
        <Link href={href("/student/buried-treasure")} className="primary">
          Continue Script Evaluation
        </Link>
      </div>
    </article>
  );
}
