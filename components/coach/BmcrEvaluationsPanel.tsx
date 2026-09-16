"use client";

import { useEffect, useId, useMemo, useState } from "react";
import BmcrCalculator from "@/components/lesson/BmcrCalculator";
import {
  computeBmcrPct,
  fetchStudentBmcrEvaluations,
  formatMarksWithPct,
  formatPct,
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
} from "@/lib/custom-surveys";
import { formatSastDateTime } from "@/lib/dates";
import { fetchCourseOutline } from "@/lib/student-lesson";

type SurveyPack = { survey: CustomSurvey; response: CustomSurveyResponse };

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
  const bmcrPacks = packs.filter((pack) => pack.survey.questions.some((question) => isBmcrBlock(question.type)));
  return bmcrPacks.length === 1 ? bmcrPacks[0] : null;
}

function taskTitle(evaluation: BmcrEvaluation, lessonTitles: Record<string, string>, pack: SurveyPack | null): string {
  if (pack?.survey.title) return pack.survey.title;
  if (evaluation.assignment_id.startsWith("survey:")) return "Standalone survey BMCR";
  return lessonTitles[evaluation.assignment_id] || evaluation.assignment_id;
}

function checklistItems(pack: SurveyPack | null): { label: string; value: string }[] {
  if (!pack) return [];
  return pack.survey.questions
    .filter((question) => {
      if (!questionCollectsAnswer(question.type) || isBmcrBlock(question.type) || isInfoBlock(question.type)) return false;
      if (question.type === "multi_select") return false;
      if (question.id === "q-takeaway" || /takeaway/i.test(question.label)) return false;
      return true;
    })
    .map((question) => ({
      label: question.label,
      value: formatSurveyAnswer(pack.response.answers[question.id], question.type),
    }))
    .filter((item) => item.value);
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
  const selectedChecklist = checklistItems(selectedPack);

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
                <th />
              </tr>
            </thead>
            <tbody>
              {evaluations.map((evaluation) => {
                const pack = matchSurveyPack(evaluation, packs);
                const marks = withQuestionTotal(evaluation);
                const rowId = evaluation.id || evaluation.assignment_id;
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
                    aria-label={`View BMCR breakdown for ${taskTitle(evaluation, lessonTitles, pack)}`}
                  >
                    <td>
                      <strong>{taskTitle(evaluation, lessonTitles, pack)}</strong>
                    </td>
                    <td className="muted small">
                      {evaluation.submitted_at ? formatSastDateTime(evaluation.submitted_at) || evaluation.submitted_at.slice(0, 10) : "—"}
                    </td>
                    <td>
                      {formatMarksWithPct(marks.question_total_my_marks, marks.question_total_markplan)}
                    </td>
                    <td>
                      {formatMarksWithPct(marks.basic_markplan, marks.question_total_markplan)}
                    </td>
                    <td>
                      <strong>{formatPct(evaluation.bmcr_conversion_pct ?? computeBmcrPct(marks))}</strong>
                    </td>
                    <td className="row-go">View full breakdown →</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No BMCR evaluations yet.</p>
      )}

      {selected ? (
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
                <h2 id={titleId}>{taskTitle(selected, lessonTitles, selectedPack)}</h2>
                <p className="muted small">
                  {selected.submitted_at ? formatSastDateTime(selected.submitted_at) || selected.submitted_at.slice(0, 10) : "Submitted"}
                </p>
              </div>
              <button className="ghost" type="button" onClick={() => setSelectedId(null)}>
                Close
              </button>
            </div>
            <BmcrCalculator readOnly idPrefix={`coach-detail-${selected.id || selected.assignment_id}`} value={selected} />
            {selectedChecklist.length ? (
              <>
                <h3>Task checklist</h3>
                <dl className="bmcr-checklist">
                  {selectedChecklist.map((item) => (
                    <div key={item.label}>
                      <dt>{item.label}</dt>
                      <dd>{item.value}</dd>
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
