"use client";

import { useMemo, useState } from "react";
import {
  averageNumbers,
  bmcrTier,
  computeBasicMarkPct,
  computeBmcrPct,
  formatPct,
  hasBmcrDiagnostics,
  isPerceptionMismatch,
  withQuestionTotal,
  type BmcrEvaluation,
} from "@/lib/bmcr";
import { COURSE_COHORTS, uniqueStudentFilterTags, studentHasTag } from "@/lib/cohorts";
import { cohortName } from "@/lib/course";
import { useStore } from "@/lib/store";
import type { FlatLesson, Student } from "@/lib/types";

interface Props {
  students: Student[];
  allStudents: Student[];
  evaluations: BmcrEvaluation[];
  lessons: FlatLesson[];
  surveyTitles: Record<string, string>;
  loading: boolean;
}

function taskTitle(assignmentId: string, lessons: FlatLesson[], surveyTitles: Record<string, string>): string {
  if (assignmentId.startsWith("survey:")) {
    const surveyId = assignmentId.slice(7);
    return surveyTitles[surveyId] || "Standalone survey BMCR";
  }
  const lesson = lessons.find((item) => item.id === assignmentId);
  return lesson?.title || assignmentId;
}

function meanPct(values: number[]): string {
  const avg = averageNumbers(values);
  return avg == null ? "—" : formatPct(avg);
}

export default function BmcrAnalyticsTab({
  students,
  allStudents,
  evaluations,
  lessons,
  surveyTitles,
  loading,
}: Props) {
  const { data, coach, setCoach } = useStore();
  const [tag, setTag] = useState("all");
  const tags = useMemo(() => uniqueStudentFilterTags(allStudents), [allStudents]);

  const scopedStudents = useMemo(
    () => students.filter((student) => studentHasTag(student, tag)),
    [students, tag]
  );
  const scopedIds = useMemo(() => new Set(scopedStudents.map((student) => student.id)), [scopedStudents]);
  const scopedEvals = useMemo(
    () => evaluations.filter((evaluation) => scopedIds.has(evaluation.student_id)),
    [evaluations, scopedIds]
  );

  const theoryValues = scopedEvals.map((evaluation) => computeBasicMarkPct(withQuestionTotal(evaluation)));
  const conversionValues = scopedEvals.map((evaluation) => computeBmcrPct(withQuestionTotal(evaluation)));

  const byStudent = useMemo(() => {
    const map = new Map<string, number[]>();
    scopedEvals.forEach((evaluation) => {
      const list = map.get(evaluation.student_id) || [];
      list.push(computeBmcrPct(withQuestionTotal(evaluation)));
      map.set(evaluation.student_id, list);
    });
    return map;
  }, [scopedEvals]);

  const tiers = useMemo(() => {
    let low = 0;
    let mid = 0;
    let high = 0;
    byStudent.forEach((values) => {
      const avg = averageNumbers(values);
      if (avg == null) return;
      const tier = bmcrTier(avg);
      if (tier === "high") high += 1;
      else if (tier === "mid") mid += 1;
      else low += 1;
    });
    return { low, mid, high, scored: low + mid + high, none: scopedStudents.length - (low + mid + high) };
  }, [byStudent, scopedStudents.length]);

  const taskRows = useMemo(() => {
    const grouped = new Map<string, BmcrEvaluation[]>();
    scopedEvals.forEach((evaluation) => {
      const key = evaluation.assignment_id || "unknown";
      const list = grouped.get(key) || [];
      list.push(evaluation);
      grouped.set(key, list);
    });
    return [...grouped.entries()]
      .map(([assignmentId, rows]) => {
        const conversions = rows.map((row) => computeBmcrPct(withQuestionTotal(row)));
        const theory = rows.map((row) => computeBasicMarkPct(withQuestionTotal(row)));
        return {
          assignmentId,
          title: taskTitle(assignmentId, lessons, surveyTitles),
          count: rows.length,
          avgTheory: averageNumbers(theory),
          avgBmcr: averageNumbers(conversions),
          stillNeedTheory: rows.filter((row) => row.feels_needs_theory === true).length,
          mismatch: rows.filter((row) => isPerceptionMismatch(row)).length,
        };
      })
      .sort((left, right) => (left.avgBmcr ?? 101) - (right.avgBmcr ?? 101));
  }, [lessons, scopedEvals, surveyTitles]);

  const diagnosticStats = useMemo(() => {
    const answered = scopedEvals.filter((evaluation) => hasBmcrDiagnostics(evaluation));
    return {
      answered: answered.length,
      stillNeedTheory: answered.filter((evaluation) => evaluation.feels_needs_theory === true).length,
      feelingsUnreliable: answered.filter((evaluation) => evaluation.feelings_reliable === false).length,
      mismatch: scopedEvals.filter((evaluation) => isPerceptionMismatch(evaluation)).length,
    };
  }, [scopedEvals]);
  const scored = tiers.scored;
  const share = (count: number) => (scored ? (count / scored) * 100 : 0);
  const cohortLabel = coach.cohort === "all" ? "All cohorts" : cohortName(data, coach.cohort);

  if (loading) return <p className="empty">Loading BMCR analytics…</p>;

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>BMCR Analytics</h2>
          <p className="muted small">
            {cohortLabel}
            {tag !== "all" ? ` · ${tags.find((item) => item.value === tag)?.label || "tag"}` : ""} ·{" "}
            {scopedStudents.length} student{scopedStudents.length === 1 ? "" : "s"} · {scopedEvals.length} evaluation
            {scopedEvals.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="actions">
          <label className="role-chip">
            Cohort
            <select id="bmcr-cohort" value={coach.cohort} onChange={(event) => setCoach({ cohort: event.target.value })}>
              <option value="all">All cohorts</option>
              {COURSE_COHORTS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.current ? " (current)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="role-chip">
            Student tag
            <select id="bmcr-tag" value={tag} onChange={(event) => setTag(event.target.value)}>
              <option value="all">All tags</option>
              {tags.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!scopedEvals.length ? (
        <p className="empty">No BMCR evaluations submitted yet.</p>
      ) : (
        <>
          <div className="bmcr-stats bmcr-analytics-stats">
            <div className="bmcr-stat">
              <span>Avg Theory Available</span>
              <b>{meanPct(theoryValues)}</b>
              <small>% What They Know · Basic Markplan / Total Markplan</small>
            </div>
            <div className="bmcr-stat">
              <span>Avg BMCR Conversion</span>
              <b>{meanPct(conversionValues)}</b>
              <small>% What They Can Use · Basic My Marks / Basic Markplan</small>
            </div>
          </div>

          <h3 className="bmcr-submission-heading">Perception vs reality</h3>
          <p className="muted small">
            Self-eval answers from the BMCR Calculator. Mismatch = still feels they need theory while BMCR is under 60%.
          </p>
          <div className="bmcr-stats bmcr-analytics-stats">
            <div className="bmcr-stat">
              <span>Still feel they need theory</span>
              <b>{diagnosticStats.stillNeedTheory}</b>
              <small>of {diagnosticStats.answered} answered evaluations</small>
            </div>
            <div className="bmcr-stat">
              <span>Feelings not reliable</span>
              <b>{diagnosticStats.feelingsUnreliable}</b>
              <small>answered “No” to “Are your feelings reliable?”</small>
            </div>
            <div className="bmcr-stat">
              <span>Perception mismatch</span>
              <b>{diagnosticStats.mismatch}</b>
              <small>Need theory = Yes, and BMCR &lt; 60%</small>
            </div>
          </div>

          <h3 className="bmcr-submission-heading">Diagnostic tier breakdown</h3>
          <p className="muted small">
            Students bucketed by their average BMCR conversion. {tiers.none} with no evaluation yet.
          </p>
          <div className="bmcr-tier-bar" aria-hidden="true">
            <span className="bmcr-tier-seg low" style={{ width: `${share(tiers.low)}%` }} />
            <span className="bmcr-tier-seg mid" style={{ width: `${share(tiers.mid)}%` }} />
            <span className="bmcr-tier-seg high" style={{ width: `${share(tiers.high)}%` }} />
          </div>
          <div className="bmcr-tier-legend">
            <div>
              <strong>{tiers.low}</strong>
              <span className="muted small">
                {formatPct(share(tiers.low))} · &lt;60% BMCR · Theory conversion leak
              </span>
            </div>
            <div>
              <strong>{tiers.mid}</strong>
              <span className="muted small">{formatPct(share(tiers.mid))} · 60–79.9% BMCR</span>
            </div>
            <div>
              <strong>{tiers.high}</strong>
              <span className="muted small">{formatPct(share(tiers.high))} · ≥80% BMCR</span>
            </div>
          </div>

          <h3 className="bmcr-submission-heading">Task-by-task comparison</h3>
          <p className="muted small">Lowest average BMCR first, so the hardest task sits at the top.</p>
          {taskRows.length ? (
            <table className="data-table bmcr-summary-table">
              <thead>
                <tr>
                  <th>Task / case study</th>
                  <th>Evaluations</th>
                  <th>Avg theory available</th>
                  <th>Avg BMCR conversion</th>
                  <th>Need theory</th>
                  <th>Mismatch</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.map((row) => (
                  <tr key={row.assignmentId}>
                    <td>
                      <strong>{row.title}</strong>
                    </td>
                    <td className="muted small">{row.count}</td>
                    <td>{row.avgTheory == null ? "—" : formatPct(row.avgTheory)}</td>
                    <td>
                      <strong>{row.avgBmcr == null ? "—" : formatPct(row.avgBmcr)}</strong>
                    </td>
                    <td className="muted small">{row.stillNeedTheory}</td>
                    <td>
                      <strong>{row.mismatch}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="empty">No BMCR evaluations submitted yet.</p>
          )}
        </>
      )}
    </section>
  );
}
