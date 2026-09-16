"use client";

import { useEffect, useId, useMemo, useState } from "react";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  computeBmcrPct,
  fetchStudentBmcrEvaluations,
  formatMarksWithPct,
  formatPct,
  formatYesNo,
  hasBmcrDiagnostics,
  parseBmcrAnswer,
  perceptionMismatchNote,
  withQuestionTotal,
  type BmcrEvaluation,
} from "@/lib/bmcr";
import {
  fetchStudentSurveyPacks,
  formatSurveyAnswer,
  isBmcrBlock,
  isInfoBlock,
  questionCollectsAnswer,
  type CustomSurvey,
  type CustomSurveyResponse,
  type SurveyQuestionType,
} from "@/lib/custom-surveys";
import { formatSastDateTime } from "@/lib/dates";
import { fetchCourseOutline } from "@/lib/student-lesson";
import SurveyAnswerValue from "@/components/ui/SurveyAnswerValue";

type SurveyPack = { survey: CustomSurvey; response: CustomSurveyResponse };

function mergeDiagnostics(evaluation: BmcrEvaluation, pack: SurveyPack | null): BmcrEvaluation {
  if (hasBmcrDiagnostics(evaluation) || !pack) return evaluation;
  const question = pack.survey.questions.find((item) => isBmcrBlock(item.type));
  if (!question) return evaluation;
  const parsed = parseBmcrAnswer(pack.response.answers[question.id]);
  if (!hasBmcrDiagnostics(parsed)) return evaluation;
  return {
    ...evaluation,
    feels_needs_theory: parsed.feels_needs_theory,
    feelings_reliable: parsed.feelings_reliable,
  };
}

function sameDay(left?: string, right?: string): boolean {
  if (!left || !right) return false;
  return left.slice(0, 10) === right.slice(0, 10);
}

function matchSurveyPack(evaluation: BmcrEvaluation, packs: SurveyPack[]): SurveyPack | null {
  const surveyId = evaluation.assignment_id.startsWith("survey:") ? evaluation.assignment_id.slice(7) : "";
  if (surveyId) {
    const exact = packs.find((pack) => pack.survey.id === surveyId);
    if (exact) return exact;
  }
  const takeaway = evaluation.key_takeaways.trim();
  if (takeaway) {
    const byTakeaway = packs.find((pack) => {
      const question =
        pack.survey.questions.find((item) => item.id === "q-takeaway") ||
        pack.survey.questions.find((item) => /takeaway/i.test(item.label));
      const answer = question ? pack.response.answers[question.id] : "";
      return (answer || "").trim() === takeaway;
    });
    if (byTakeaway) return byTakeaway;
  }
  const sameDayPack = packs.find(
    (pack) => pack.survey.questions.some((question) => isBmcrBlock(question.type)) && sameDay(pack.response.createdAt, evaluation.submitted_at)
  );
  if (sameDayPack) return sameDayPack;
  return null;
}

function taskTitle(evaluation: BmcrEvaluation, lessonTitles: Record<string, string>, pack: SurveyPack | null): string {
  if (pack?.survey.title) return pack.survey.title;
  if (evaluation.assignment_id.startsWith("survey:")) return "Standalone survey BMCR";
  return lessonTitles[evaluation.assignment_id] || evaluation.assignment_id;
}

function checklistItems(
  pack: SurveyPack | null
): { id: string; label: string; value: string; type: SurveyQuestionType }[] {
  if (!pack) return [];
  return pack.survey.questions
    .filter((question) => {
      if (!questionCollectsAnswer(question.type) || isBmcrBlock(question.type) || isInfoBlock(question.type)) return false;
      if (question.type === "multi_select") return false;
      if (question.id === "q-takeaway" || /takeaway/i.test(question.label)) return false;
      return true;
    })
    .map((question) => ({
      id: question.id,
      label: question.label,
      value: pack.response.answers[question.id] || "",
      type: question.type,
    }))
    .filter((item) => formatSurveyAnswer(item.value, item.type));
}

export default function BmcrEvaluationsPanel({ studentId }: { studentId: string }) {
  const titleId = useId();
  const [evaluations, setEvaluations] = useState<BmcrEvaluation[]>([]);
  const [packs, setPacks] = useState<SurveyPack[]>([]);
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchStudentBmcrEvaluations(studentId),
      fetchStudentSurveyPacks(studentId),
      fetchCourseOutline(),
    ]).then(([nextEvaluations, nextPacks, outline]) => {
      if (cancelled) return;
      setEvaluations(nextEvaluations);
      setPacks(nextPacks);
      const titles: Record<string, string> = {};
      outline.forEach((chapter) => {
        chapter.lessons.forEach((lesson) => {
          titles[lesson.id] = lesson.title;
        });
      });
      setLessonTitles(titles);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const selected = useMemo(
    () => evaluations.find((item) => (item.id || item.assignment_id) === selectedId) || null,
    [evaluations, selectedId]
  );
  const selectedPack = selected ? matchSurveyPack(selected, packs) : null;
  const selectedRow = selected ? mergeDiagnostics(selected, selectedPack) : null;
  const selectedChecklist = checklistItems(selectedPack);
  const selectedMismatch = selectedRow ? perceptionMismatchNote(selectedRow) : null;

  useEffect(() => {
    if (!selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <section className="card">
      <h2>BMCR evaluations</h2>
      {evaluations.length ? (
        <div className="table-wrap">
          <table className="data-table bmcr-summary-table">
            <thead>
              <tr>
                <th>Task</th>
                <th>Submitted</th>
                <th>Actual mark earned</th>
                <th>What they know</th>
                <th>What they can use</th>
                <th>Self-eval</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation) => {
                const pack = matchSurveyPack(evaluation, packs);
                const row = mergeDiagnostics(evaluation, pack);
                const marks = withQuestionTotal(row);
                const rowId = row.id || row.assignment_id;
                const mismatch = perceptionMismatchNote(row);
                return (
                  <tr
                    key={rowId}
                    onClick={() => setSelectedId(rowId)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedId(rowId);
                      }
                    }}
                    tabIndex={0}
                    aria-label={`View BMCR breakdown for ${taskTitle(row, lessonTitles, pack)}`}
                  >
                    <td>
                      <strong>{taskTitle(row, lessonTitles, pack)}</strong>
                    </td>
                    <td className="muted small">
                      {row.submitted_at ? formatSastDateTime(row.submitted_at) || row.submitted_at.slice(0, 10) : "—"}
                    </td>
                    <td>
                      {formatMarksWithPct(marks.question_total_my_marks, marks.question_total_markplan)}
                    </td>
                    <td>
                      {formatMarksWithPct(marks.basic_markplan, marks.question_total_markplan)}
                    </td>
                    <td>
                      <strong>{formatPct(row.bmcr_conversion_pct ?? computeBmcrPct(marks))}</strong>
                    </td>
                    <td>
                      {hasBmcrDiagnostics(row) ? (
                        <>
                          <div className="muted small">Need theory: {formatYesNo(row.feels_needs_theory)}</div>
                          <div className="muted small">Feelings reliable: {formatYesNo(row.feelings_reliable)}</div>
                          {mismatch ? <span className="badge">Mismatch</span> : null}
                        </>
                      ) : (
                        <span className="muted small">—</span>
                      )}
                    </td>
                    <td className="row-go">View full breakdown →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No BMCR evaluations submitted yet.</p>
      )}

      {selected && selectedRow ? (
        <div className="modal-backdrop" onClick={() => setSelectedId(null)}>
          <section
            className="modal bmcr-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="bmcr-detail-head">
              <div>
                <h2 id={titleId}>{taskTitle(selectedRow, lessonTitles, selectedPack)}</h2>
                <p className="muted small">
                  {selectedRow.submitted_at ? formatSastDateTime(selectedRow.submitted_at) || selectedRow.submitted_at.slice(0, 10) : "Submitted"}
                </p>
              </div>
              <button className="ghost" type="button" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            <BmcrCalculator readOnly idPrefix={`coach-detail-${selectedRow.id || selectedRow.assignment_id}`} value={selectedRow} />
            {selectedMismatch ? (
              <aside className="bmcr-mismatch">
                <strong>Perception vs reality</strong>
                <p>{selectedMismatch}</p>
              </aside>
            ) : null}
            {hasBmcrDiagnostics(selectedRow) ? (
              <>
                <h3>Self-evaluation diagnostics</h3>
                <dl className="bmcr-checklist">
                  <div>
                    <dt>Do you still FEEL that you need theory?</dt>
                    <dd>{formatYesNo(selectedRow.feels_needs_theory)}</dd>
                  </div>
                  <div>
                    <dt>Are your feelings reliable?</dt>
                    <dd>{formatYesNo(selectedRow.feelings_reliable)}</dd>
                  </div>
                </dl>
              </>
            ) : null}
            {selectedChecklist.length ? (
              <>
                <h3>Task checklist</h3>
                <dl className="bmcr-checklist">
                  {selectedChecklist.map((item) => (
                    <div key={item.id}>
                      <dt>{item.label}</dt>
                      <dd>
                        <SurveyAnswerValue value={item.value} type={item.type} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            {selected.challenges.length ? (
              <>
                <h3>Challenges</h3>
                <div className="bmcr-challenges">
                  {selected.challenges.map((challenge) => (
                    <span className="badge" key={challenge}>
                      {challenge}
                    </span>
                  ))}
                </div>
              </>
            ) : null}
            {selected.key_takeaways ? (
              <>
                <h3>Key takeaway</h3>
                <p>{selected.key_takeaways}</p>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
