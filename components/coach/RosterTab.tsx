"use client";

import {
  cohortName,
  gradedLessons,
  lastActiveLabel,
  surveyFor,
  surveyLessons,
  unansweredQuestion,
} from "@/lib/course";
import { daysAgo } from "@/lib/dates";
import { overallProgress, submittedCount } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

interface Props {
  students: Student[];
  onOpenProfile: (id: string) => void;
}

export default function RosterTab({ students, onOpenProfile }: Props) {
  const { data } = useStore();
  const graded = gradedLessons(data);
  const surveys = surveyLessons(data);

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Student roster</h2>
          <p className="muted small">
            {students.length} student{students.length === 1 ? "" : "s"} · click any row for the full profile
          </p>
        </div>
      </div>
      <table className="data-table roster">
        <thead>
          <tr>
            <th>Student</th>
            <th>Cohort</th>
            <th>Course progress</th>
            <th>Submitted</th>
            <th>Surveys</th>
            <th>Waiting</th>
            <th>Last active</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {students.map((s) => {
            const p = overallProgress(data, s);
            const ask = unansweredQuestion(data, s.id);
            const answered = surveys.filter((l) => surveyFor(s, l.id)).length;
            const stale = (daysAgo(s.lastActive) || 0) >= 7 && s.status !== "paused";
            return (
              <tr key={s.id} onClick={() => onOpenProfile(s.id)}>
                <td>
                  <strong>{s.name}</strong>
                  <span className="cell-sub">{s.email}</span>
                </td>
                <td className="muted small">{cohortName(data, s.cohort)}</td>
                <td>
                  <div className="mini-bar">
                    <span style={{ width: `${p.pct}%` }} />
                  </div>
                  <span className="cell-sub">
                    {p.done} of {p.total} · {p.pct}%
                  </span>
                </td>
                <td className="muted small">
                  {submittedCount(data, s)} of {graded.length}
                </td>
                <td className="muted small">
                  {answered} of {surveys.length}
                </td>
                <td>{ask ? <span className="badge ask">Question</span> : <span className="muted small">—</span>}</td>
                <td className={`muted small ${stale ? "stale" : ""}`}>{lastActiveLabel(s)}</td>
                <td>
                  <span className={`badge ${s.status === "paused" ? "warn" : "ok"}`}>
                    {s.status === "paused" ? "Paused" : "Active"}
                  </span>
                </td>
                <td className="row-go">Open profile →</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
