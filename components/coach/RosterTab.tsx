"use client";

import { useState } from "react";
import { labelForGroup } from "@/lib/comms";
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
  const { data, setNotifyDraft } = useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const graded = gradedLessons(data);
  const surveys = surveyLessons(data);

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const toggleAll = () => {
    setSelected((current) => (current.length === students.length ? [] : students.map((s) => s.id)));
  };

  const notifyFiltered = () => {
    if (!students.length) return;
    setNotifyDraft({
      audience: "filtered",
      audienceLabel: labelForGroup(data, students, "filtered", "Roster"),
      recipientIds: students.map((s) => s.id),
    });
  };

  const notifySelected = () => {
    const picked = students.filter((s) => selected.includes(s.id));
    if (!picked.length) return;
    setNotifyDraft({
      audience: "selected",
      audienceLabel: labelForGroup(data, picked, "selected"),
      recipientIds: picked.map((s) => s.id),
    });
  };

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Student roster</h2>
          <p className="muted small">
            {students.length} student{students.length === 1 ? "" : "s"} · click a name for the profile, or tick rows
            to notify a selection
          </p>
        </div>
        <div className="actions">
          <button className="primary" onClick={notifyFiltered} disabled={!students.length}>
            Notify this group ({students.length})
          </button>
          <button className="ghost" onClick={notifySelected} disabled={!selected.length}>
            Notify selected ({selected.length})
          </button>
        </div>
      </div>
      <table className="data-table roster">
        <thead>
          <tr>
            <th className="check-col">
              <input
                type="checkbox"
                checked={Boolean(students.length && selected.length === students.length)}
                onChange={toggleAll}
                aria-label="Select all visible students"
              />
            </th>
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
                <td className="check-col" onClick={(event) => event.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.id)}
                    onChange={() => toggle(s.id)}
                    aria-label={`Select ${s.name}`}
                  />
                </td>
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
