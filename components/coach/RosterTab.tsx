"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import RosterFilterBuilder from "@/components/coach/RosterFilterBuilder";
import { labelForGroup } from "@/lib/comms";
import {
  cohortName,
  gradedLessons,
  lastActiveLabel,
  surveyFor,
  surveyLessons,
  unansweredQuestion,
} from "@/lib/course";
import { daysAgo, isoDate, today } from "@/lib/dates";
import { overallProgress, submittedCount } from "@/lib/metrics";
import {
  DEFAULT_ROSTER_COLUMNS,
  ROSTER_COLUMNS,
  downloadRosterCsv,
  matchRosterRules,
  onboardingStatus,
  onboardingStatusLabel,
  rosterColumnLabel,
  sanitizeRosterColumns,
  type RosterColumnId,
  type RosterFilterLogic,
  type RosterFilterRule,
  type RosterSortDir,
} from "@/lib/roster";
import { fetchCoachRosterColumns, saveCoachRosterColumns } from "@/lib/roster-preferences";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

interface Props {
  students: Student[];
  onOpenProfile: (id: string) => void;
}

interface RosterRow {
  student: Student;
  cohortLabel: string;
  onboarding: "completed" | "skipped" | "pending";
  progressPct: number;
  progressDone: number;
  progressTotal: number;
  submitted: number;
  surveysAnswered: number;
  surveysTotal: number;
  waiting: boolean;
  stale: boolean;
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function sortValue(row: RosterRow, column: RosterColumnId): string | number {
  const { student } = row;
  switch (column) {
    case "name":
      return student.name;
    case "email":
      return student.email;
    case "phone":
      return student.phone || "";
    case "accountabilityEmail":
      return student.accountabilityEmail || "";
    case "cohort":
      return student.cohort || row.cohortLabel;
    case "onboarding":
      return student.onboardingCompleted ? 1 : 0;
    case "country":
      return student.country || "";
    case "ctaUniversity":
      return student.ctaUniversity || "";
    case "ctaYear":
      return student.ctaYear || "";
    case "iacAttempts":
      return Number(student.iacAttempts) || student.iacAttempts || "";
    case "repeatStudent":
      return student.repeatStudent ? 1 : 0;
    case "coachingGoals":
      return student.coachingGoals || "";
    case "struggleAreas":
      return student.struggleAreas || "";
    case "progress":
      return row.progressPct;
    case "lastActive":
      return student.lastActive || "";
    case "status":
      return student.status === "paused" ? 0 : 1;
    case "submitted":
      return row.submitted;
    case "surveys":
      return row.surveysAnswered;
    case "waiting":
      return row.waiting ? 1 : 0;
    default:
      return "";
  }
}

function plainCell(id: RosterColumnId, row: RosterRow, gradedTotal: number): string {
  const { student } = row;
  switch (id) {
    case "name":
      return student.name;
    case "email":
      return student.email;
    case "phone":
      return student.phone || "";
    case "accountabilityEmail":
      return student.accountabilityEmail || "";
    case "cohort":
      return student.cohort;
    case "onboarding":
      return student.onboardingCompleted ? "true" : "false";
    case "country":
      return student.country || "";
    case "ctaUniversity":
      return student.ctaUniversity || "";
    case "ctaYear":
      return student.ctaYear || "";
    case "iacAttempts":
      return student.iacAttempts || "";
    case "repeatStudent":
      return student.repeatStudent ? "true" : "false";
    case "coachingGoals":
      return student.coachingGoals || "";
    case "struggleAreas":
      return student.struggleAreas || "";
    case "progress":
      return `${row.progressDone} of ${row.progressTotal} (${row.progressPct}%)`;
    case "lastActive":
      return lastActiveLabel(student);
    case "status":
      return student.status === "paused" ? "Paused" : "Active";
    case "submitted":
      return `${row.submitted} of ${gradedTotal}`;
    case "surveys":
      return `${row.surveysAnswered} of ${row.surveysTotal}`;
    case "waiting":
      return row.waiting ? "Question" : "";
    default:
      return "";
  }
}

function RosterMenu({
  id,
  label,
  openId,
  setOpenId,
  children,
}: {
  id: string;
  label: string;
  openId: string | null;
  setOpenId: (id: string | null) => void;
  children: ReactNode;
}) {
  const open = openId === id;
  return (
    <div className="roster-menu">
      <button className="ghost roster-menu-btn" type="button" aria-expanded={open} onClick={() => setOpenId(open ? null : id)}>
        {label}
      </button>
      {open ? <div className="roster-menu-panel">{children}</div> : null}
    </div>
  );
}

export default function RosterTab({ students, onOpenProfile }: Props) {
  const { data, setNotifyDraft } = useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<RosterFilterRule[]>([]);
  const [logic, setLogic] = useState<RosterFilterLogic>("and");
  const [columns, setColumns] = useState<RosterColumnId[]>(DEFAULT_ROSTER_COLUMNS);
  const [sortKey, setSortKey] = useState<RosterColumnId>("name");
  const [sortDir, setSortDir] = useState<RosterSortDir>("asc");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const graded = gradedLessons(data);
  const surveys = surveyLessons(data);

  useEffect(() => {
    fetchCoachRosterColumns().then((saved) => {
      if (saved) setColumns(saved);
    });
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenu]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const enriched: RosterRow[] = students.map((student) => {
      const progress = overallProgress(data, student);
      return {
        student,
        cohortLabel: cohortName(data, student.cohort),
        onboarding: onboardingStatus(student),
        progressPct: progress.pct,
        progressDone: progress.done,
        progressTotal: progress.total,
        submitted: submittedCount(data, student),
        surveysAnswered: surveys.filter((lesson) => surveyFor(student, lesson.id)).length,
        surveysTotal: surveys.length,
        waiting: Boolean(unansweredQuestion(data, student.id)),
        stale: (daysAgo(student.lastActive) || 0) >= 7 && student.status !== "paused",
      };
    });

    const filtered = enriched.filter((row) => {
      const { student } = row;
      if (query) {
        const haystack = [student.name, student.email, student.phone || ""].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return matchRosterRules(student, rules, logic);
    });

    const direction = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const left = sortValue(a, sortKey);
      const right = sortValue(b, sortKey);
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return compareText(String(left), String(right)) * direction;
    });
  }, [data, logic, rules, search, sortDir, sortKey, students, surveys]);

  const visible = columns.filter((id) => ROSTER_COLUMNS.some((column) => column.id === id));
  const visibleIds = rows.map((row) => row.student.id);
  const allVisibleSelected = Boolean(visibleIds.length && visibleIds.every((id) => selected.includes(id)));

  const toggle = (id: string) => {
    setSelected((current) => toggleValue(current, id));
  };

  const toggleAll = () => {
    setSelected((current) =>
      allVisibleSelected ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const notifyFiltered = () => {
    if (!rows.length) return;
    setNotifyDraft({
      audience: "filtered",
      audienceLabel: labelForGroup(
        data,
        rows.map((row) => row.student),
        "filtered",
        "Roster"
      ),
      recipientIds: rows.map((row) => row.student.id),
    });
  };

  const notifySelected = () => {
    const picked = rows.filter((row) => selected.includes(row.student.id)).map((row) => row.student);
    if (!picked.length) return;
    setNotifyDraft({
      audience: "selected",
      audienceLabel: labelForGroup(data, picked, "selected"),
      recipientIds: picked.map((student) => student.id),
    });
  };

  const setVisibleColumns = (next: RosterColumnId[]) => {
    const sanitized = sanitizeRosterColumns(next);
    setColumns(sanitized);
    void saveCoachRosterColumns(sanitized);
  };

  const toggleColumn = (id: RosterColumnId) => {
    const next = visible.includes(id) ? visible.filter((column) => column !== id) : [...visible, id];
    if (!next.length) return;
    setVisibleColumns(next);
  };

  const cycleSort = (id: RosterColumnId) => {
    if (sortKey === id) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(id);
    setSortDir("asc");
  };

  const exportCsv = () => {
    downloadRosterCsv(
      `student-roster-${isoDate(today())}.csv`,
      visible.map(rosterColumnLabel),
      rows.map((row) => visible.map((id) => plainCell(id, row, graded.length)))
    );
  };

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Student roster</h2>
          <p className="muted small">
            {rows.length} of {students.length} student{students.length === 1 ? "" : "s"} · click a name for the
            profile, or tick rows to notify a selection
          </p>
        </div>
        <div className="actions">
          <button className="ghost" type="button" onClick={exportCsv} disabled={!rows.length}>
            Export
          </button>
          <button className="primary" onClick={notifyFiltered} disabled={!rows.length}>
            Notify this group ({rows.length})
          </button>
          <button className="ghost" onClick={notifySelected} disabled={!selected.length}>
            Notify selected ({selected.length})
          </button>
        </div>
      </div>

      <div className="roster-toolbar" ref={toolbarRef}>
        <input
          className="select-line roster-search"
          type="search"
          placeholder="Search name, email, or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          aria-label="Search students"
        />
        <RosterMenu id="columns" label="Columns" openId={openMenu} setOpenId={setOpenMenu}>
          {ROSTER_COLUMNS.map((column) => (
            <label className="roster-check" key={column.id}>
              <input type="checkbox" checked={visible.includes(column.id)} onChange={() => toggleColumn(column.id)} />
              {column.label}
            </label>
          ))}
        </RosterMenu>
      </div>

      <RosterFilterBuilder rules={rules} logic={logic} onChangeRules={setRules} onChangeLogic={setLogic} />

      <div className="roster-table-wrap">
        <table className="data-table roster">
          <thead>
            <tr>
              <th className="check-col">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  onChange={toggleAll}
                  aria-label="Select all visible students"
                />
              </th>
              {visible.map((id) => (
                <th key={id} aria-sort={sortKey === id ? (sortDir === "asc" ? "ascending" : "descending") : "none"}>
                  <button className="roster-sort" type="button" onClick={() => cycleSort(id)}>
                    {rosterColumnLabel(id)}
                    {sortKey === id ? (
                      sortDir === "asc" ? (
                        <ChevronUp size={14} aria-hidden="true" />
                      ) : (
                        <ChevronDown size={14} aria-hidden="true" />
                      )
                    ) : null}
                  </button>
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.length ? (
              rows.map((row) => (
                <tr key={row.student.id} onClick={() => onOpenProfile(row.student.id)}>
                  <td className="check-col" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(row.student.id)}
                      onChange={() => toggle(row.student.id)}
                      aria-label={`Select ${row.student.name}`}
                    />
                  </td>
                  {visible.map((id) => (
                    <td key={id}>{cellFor(id, row, graded.length)}</td>
                  ))}
                  <td className="row-go">Open profile →</td>
                </tr>
              ))
            ) : (
              <tr className="roster-empty">
                <td colSpan={visible.length + 2}>No students match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function cellFor(id: RosterColumnId, row: RosterRow, gradedTotal: number) {
  const { student } = row;
  switch (id) {
    case "name":
      return <strong>{student.name}</strong>;
    case "email":
      return <span className="muted small">{student.email}</span>;
    case "phone":
      return <span className="muted small">{student.phone || "—"}</span>;
    case "accountabilityEmail":
      return <span className="muted small">{student.accountabilityEmail || "—"}</span>;
    case "cohort":
      return (
        <>
          <span className="muted small">{student.cohort}</span>
          {row.cohortLabel !== student.cohort ? <span className="cell-sub">{row.cohortLabel}</span> : null}
        </>
      );
    case "onboarding":
      return (
        <span className={`badge ${row.onboarding === "completed" ? "ok" : row.onboarding === "skipped" ? "warn" : ""}`}>
          {onboardingStatusLabel(row.onboarding)}
        </span>
      );
    case "country":
      return <span className="muted small">{student.country || "—"}</span>;
    case "ctaUniversity":
      return <span className="muted small">{student.ctaUniversity || "—"}</span>;
    case "ctaYear":
      return <span className="muted small">{student.ctaYear || "—"}</span>;
    case "iacAttempts":
      return <span className="muted small">{student.iacAttempts || "—"}</span>;
    case "repeatStudent":
      return <span className="muted small">{student.repeatStudent ? "True" : "False"}</span>;
    case "coachingGoals":
      return <span className="muted small">{student.coachingGoals || "—"}</span>;
    case "struggleAreas":
      return <span className="muted small">{student.struggleAreas || "—"}</span>;
    case "progress":
      return (
        <>
          <div className="mini-bar">
            <span style={{ width: `${row.progressPct}%` }} />
          </div>
          <span className="cell-sub">
            {row.progressDone} of {row.progressTotal} · {row.progressPct}%
          </span>
        </>
      );
    case "lastActive":
      return <span className={`muted small ${row.stale ? "stale" : ""}`}>{lastActiveLabel(student)}</span>;
    case "status":
      return (
        <span className={`badge ${student.status === "paused" ? "warn" : "ok"}`}>
          {student.status === "paused" ? "Paused" : "Active"}
        </span>
      );
    case "submitted":
      return (
        <span className="muted small">
          {row.submitted} of {gradedTotal}
        </span>
      );
    case "surveys":
      return (
        <span className="muted small">
          {row.surveysAnswered} of {row.surveysTotal}
        </span>
      );
    case "waiting":
      return row.waiting ? <span className="badge ask">Question</span> : <span className="muted small">—</span>;
    default:
      return null;
  }
}
