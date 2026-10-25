"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchAllSurveySubmissions,
  surveyResponseStatusClass,
  surveyResponseStatusLabel,
  type SurveyResponseStatus,
  type SurveySubmissionRow,
} from "@/lib/custom-surveys";
import { formatSastDateTime } from "@/lib/dates";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import { fetchLessonSubmissionsForCoach } from "@/lib/student-submissions";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

const FORM_KINDS = [
  { id: "all", label: "Show All" },
  { id: "assignments", label: "Assignments Only" },
  { id: "surveys", label: "General Surveys Only" },
] as const;

interface Props {
  students: Student[];
}

export default function AssignmentsTab({ students }: Props) {
  const router = useRouter();
  const { coach, setCoach } = useStore();
  const [rows, setRows] = useState<SurveySubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState<SurveyResponseStatus | "all">("all");
  const [query, setQuery] = useState("");
  const formKind = coach.formKind || "all";
  const cohortIds = useMemo(() => new Set(students.map((student) => student.id)), [students]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchAllSurveySubmissions(), fetchLessonSubmissionsForCoach()]).then(([surveys, lessons]) => {
      if (cancelled) return;
      setLoading(false);
      if (!surveys.ok && !lessons.ok) {
        setError(surveys.error || "Could not load submissions.");
        return;
      }
      setError(surveys.ok ? "" : surveys.error || "");
      const merged = [...(surveys.ok ? surveys.data : []), ...(lessons.ok ? lessons.data : [])].sort((a, b) =>
        String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
      );
      setRows(merged);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = rows.filter((row) => {
    if (students.length && !cohortIds.has(row.studentId)) return false;
    if (formKind === "assignments" && !row.isAssignment) return false;
    if (formKind === "surveys" && row.isAssignment) return false;
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return `${row.studentName} ${row.studentEmail} ${row.surveyTitle}`.toLowerCase().includes(needle);
  });

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Submissions</h2>
          <p className="muted small">
            Lesson uploads and survey / assignment forms in one grading queue.
            {loading ? " Loading…" : ` ${visible.length} shown.`}
          </p>
        </div>
      </div>
      <div className="filters form-kind-filters" role="tablist" aria-label="Form type">
        {FORM_KINDS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={formKind === item.id ? "active" : ""}
            onClick={() => setCoach({ formKind: item.id })}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div className="submissions-toolbar">
        <label className="role-chip">
          Status
          <select
            className="select-line"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as SurveyResponseStatus | "all")}
            aria-label="Filter by status"
          >
            <option value="all">All statuses</option>
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
            <option value="rejected">Rejected</option>
            <option value="resubmit">Resubmit</option>
          </select>
        </label>
        <input
          className="select-line submissions-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search student or survey title"
          aria-label="Search student or survey title"
        />
      </div>
      {error ? <div className="notice">{error}</div> : null}
      {loading ? (
        <p className="empty">Loading submissions…</p>
      ) : visible.length ? (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Survey / Assignment Name</th>
                <th>Status</th>
                <th>Date Submitted</th>
                <th>Date Graded</th>
                <th>Graded By</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id} onClick={() => router.push(row.href || `/coach/submissions/${row.id}`)}>
                  <td>
                    <strong>
                      <StudentProfileLink studentId={row.studentId}>{row.studentName || "Student"}</StudentProfileLink>
                    </strong>
                    {row.studentEmail ? <span className="cell-sub">{row.studentEmail}</span> : null}
                  </td>
                  <td>
                    {row.surveyTitle}
                    {row.isAssignment ? <span className="cell-sub">Assignment</span> : <span className="cell-sub">Survey</span>}
                  </td>
                  <td>
                    <span className={`badge ${surveyResponseStatusClass(row.status)}`}>
                      {surveyResponseStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="muted small">{formatSastDateTime(row.createdAt) || row.createdAt || "—"}</td>
                  <td className="muted small">{row.gradedAt ? formatSastDateTime(row.gradedAt) || row.gradedAt : "—"}</td>
                  <td className="muted small">{row.gradedByName || "—"}</td>
                  <td className="row-go">Review →</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty">No submissions match these filters yet.</p>
      )}
    </section>
  );
}
