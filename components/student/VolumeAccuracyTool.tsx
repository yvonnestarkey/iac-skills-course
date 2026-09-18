"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CALCULATION_TAG,
  diagnosticTag,
  fetchOwnVolumeSessions,
  saveVolumePaperSession,
  volumeRatios,
  type VolumePaperSession,
} from "@/lib/volume-accuracy";
import {
  EXAM_SITTINGS,
  findPaper,
  findSitting,
  isCalculationQuestion,
  paperDisplayName,
  paperLabel,
  type ExamPaper,
  type ExamQuestion,
} from "@/lib/exam-structure";
import { useStudentSession } from "@/lib/student-session";

type Draft = { points: string; marks: string };
type DraftMap = Record<string, Draft>;

function emptyDrafts(paper: ExamPaper): DraftMap {
  return Object.fromEntries(paper.questions.map((question) => [question.code, { points: "", marks: "" }]));
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
  const defaultExam = EXAM_SITTINGS[0];
  const defaultPaper = defaultExam.papers[0];
  const [examId, setExamId] = useState(defaultExam.id);
  const [paperId, setPaperId] = useState(defaultPaper.id);
  const [drafts, setDrafts] = useState<DraftMap>(() => emptyDrafts(defaultPaper));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [sessions, setSessions] = useState<VolumePaperSession[]>([]);

  const sitting = findSitting(examId) || defaultExam;
  const paper = findPaper(examId, paperId) || sitting.papers[0];
  const paperName = paperDisplayName(sitting, paper);

  const latestForPaper = useMemo(
    () => sessions.find((session) => session.paper_code === paper.code),
    [sessions, paper.code]
  );

  const paperRef = useRef(paper);
  paperRef.current = paper;

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnVolumeSessions(user.id).then((next) => {
      setSessions(next);
      setDrafts((prev) => {
        const currentPaper = paperRef.current;
        const hasTyped = Object.values(prev).some((row) => row.points || row.marks);
        if (hasTyped) return prev;
        const match = next.find((session) => session.paper_code === currentPaper.code);
        return draftsFromSession(currentPaper, match);
      });
    });
  }, [user?.id]);

  const applyPaper = (nextPaper: ExamPaper, nextSessions = sessions) => {
    setPaperId(nextPaper.id);
    const match = nextSessions.find((session) => session.paper_code === nextPaper.code);
    setDrafts(draftsFromSession(nextPaper, match));
  };

  const setDraft = (code: string, key: keyof Draft, value: string) => {
    setDrafts((prev) => ({ ...prev, [code]: { ...(prev[code] || { points: "", marks: "" }), [key]: value } }));
  };

  const submit = async () => {
    if (!user?.id) return;
    const rows = [];
    for (const question of paper.questions) {
      const draft = drafts[question.code] || { points: "", marks: "" };
      const calc = isCalculationQuestion(question);
      if (draft.marks === "") {
        setError(`Enter Marks You Got for ${question.code}.`);
        return;
      }
      if (!calc && draft.points === "") {
        setError(`Enter Points Wrote for ${question.code}.`);
        return;
      }
      const marksGot = Number(draft.marks);
      if (marksGot > question.marks) {
        setError(`${question.code} is ${question.marks} total marks. Marks You Got cannot exceed that ceiling.`);
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
    setBusy(true);
    setError("");
    setSaved("");
    const result = await saveVolumePaperSession({
      userId: user.id,
      paper_code: paper.code,
      paper_name: paperName,
      rows,
    });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setSessions((prev) => [result.session, ...prev.filter((session) => session.session_id !== result.session.session_id)].slice(0, 6));
    setSaved(`Saved complete ${paper.title} session.`);
  };

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Pre-exam diagnostic</p>
      <h1>Volume vs Accuracy</h1>
      <p className="muted">
        Pick a paper, then fill every section. Points Wrote is N/A on calculation/disclosure questions so those rows do not skew volume.
      </p>
      <form
        className="eval-form va-form"
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
              setExamId(next.id);
              applyPaper(next.papers[0]);
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
          <select
            className="select-line"
            value={paper.id}
            onChange={(event) => {
              const nextPaper = findPaper(examId, event.target.value) || paper;
              applyPaper(nextPaper);
            }}
          >
            {sitting.papers.map((item) => (
              <option key={item.id} value={item.id}>
                {paperLabel(item)} · {item.total_marks} marks
              </option>
            ))}
          </select>
        </label>

        <div className="va-table-wrap">
          <table className="va-table">
            <caption>
              {paperLabel(paper)} · {paper.total_marks} total marks
              {latestForPaper ? " · last session loaded" : ""}
            </caption>
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

        {error ? <p className="notice">{error}</p> : null}
        {saved ? <p className="muted">{saved}</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !user?.id}>
            {busy ? "Saving…" : "Save Complete Session"}
          </button>
        </div>
      </form>
    </article>
  );
}
