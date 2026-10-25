"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import AccountActivationBadge from "@/components/coach/AccountActivationBadge";
import CourseAccessBadge from "@/components/coach/CourseAccessBadge";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import RosterFilterBuilder from "@/components/coach/RosterFilterBuilder";
import { COURSE_COHORTS } from "@/lib/cohorts";
import { labelForGroup } from "@/lib/comms";
import {
  cohortName,
  lastActiveLabel,
  unansweredQuestion,
} from "@/lib/course";
import { daysAgo, isoDate, today } from "@/lib/dates";
import { completionProgress } from "@/lib/metrics";
import { courseAccessLabel } from "@/lib/course-access";
import { accountStatusLabel, isCourseAccessClosed, showInactiveOnRoster } from "@/lib/student-registration";
import {
  DEFAULT_ROSTER_COLUMNS,
  ROSTER_COLUMNS,
  ROSTER_COURSE_ACCESS_OPTIONS,
  ROSTER_FILTER_FIELDS,
  downloadRosterCsv,
  matchRosterRule,
  newRosterFilterRule,
  onboardingStatus,
  onboardingStatusLabel,
  rosterColumnLabel,
  sanitizeRosterColumns,
  cleanRosterOptionValue,
  uniqueRosterOptions,
  type RosterColumnId,
  type RosterFilterField,
  type RosterFilterLogic,
  type RosterFilterOption,
  type RosterFilterRule,
  type RosterSortDir,
} from "@/lib/roster";
import { fetchCoachRosterColumns, saveCoachRosterColumns } from "@/lib/roster-preferences";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

interface Props {
  students: Student[];
  optionStudents?: Student[];
  lessonIds?: string[];
  submissionCounts?: Record<string, number>;
  surveyCounts?: Record<string, number>;
  surveyTotal?: number;
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
    case "courseAccess":
      return courseAccessLabel(student.courseAccess, student.accessActive);
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
      return accountStatusLabel(student);
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
    case "courseAccess":
      return courseAccessLabel(student.courseAccess, student.accessActive);
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
      return accountStatusLabel(student);
    case "submitted":
      return String(row.submitted);
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

export default function RosterTab({
  students,
  optionStudents,
  lessonIds = [],
  submissionCounts = {},
  surveyCounts = {},
  surveyTotal = 0,
  onOpenProfile,
}: Props) {
  const { data, setNotifyDraft } = useStore();
  const [accessPatch, setAccessPatch] = useState<Record<string, Partial<Student>>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [rules, setRules] = useState<RosterFilterRule[]>([]);
  const [logic, setLogic] = useState<RosterFilterLogic>("and");
  const [columns, setColumns] = useState<RosterColumnId[]>(DEFAULT_ROSTER_COLUMNS);
  const [sortKey, setSortKey] = useState<RosterColumnId>("name");
  const [sortDir, setSortDir] = useState<RosterSortDir>("asc");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [bulkExpiresOn, setBulkExpiresOn] = useState("");
  const [actionBusy, setActionBusy] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const toolbarRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchCoachRosterColumns().then((saved) => {
      if (saved) setColumns(saved);
    });
  }, []);

  useEffect(() => {
    if (!openMenu) return;
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (toolbarRef.current?.contains(target) || actionsRef.current?.contains(target)) return;
      setOpenMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openMenu]);

  const optionsByField = useMemo(() => {
    const source = optionStudents || students;
    const cohortDefaults = COURSE_COHORTS.map((cohort) => ({ value: cohort.id, label: cohort.name })).filter(
      (option) => Boolean(cleanRosterOptionValue(option.value) && cleanRosterOptionValue(option.label))
    );
    const map: Partial<Record<RosterFilterField, RosterFilterOption[]>> = {};
    ROSTER_FILTER_FIELDS.forEach((field) => {
      if (field.kind !== "categorical") return;
      map[field.id] = uniqueRosterOptions(
        source,
        field.id,
        field.id === "cohort"
          ? (value) => cohortName(data, value)
          : field.id === "courseAccess"
            ? (value) =>
                value === "deregistered"
                  ? "Deregistered"
                  : courseAccessLabel(value === "full" ? "full" : "free_preview")
            : undefined,
        field.id === "cohort"
          ? cohortDefaults
          : field.id === "courseAccess"
            ? [...ROSTER_COURSE_ACCESS_OPTIONS]
            : undefined
      ).filter((option) => Boolean(cleanRosterOptionValue(option.value)));
    });
    return map;
  }, [data, optionStudents, students]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const enriched: RosterRow[] = students.map((row) => {
      const student = { ...row, ...accessPatch[row.id] };
      const progress = completionProgress(student.completed, lessonIds);
      return {
        student,
        cohortLabel: cohortName(data, student.cohort),
        onboarding: onboardingStatus(student),
        progressPct: progress.pct,
        progressDone: progress.done,
        progressTotal: progress.total,
        submitted: submissionCounts[student.id] || 0,
        surveysAnswered: surveyCounts[student.id] || 0,
        surveysTotal: surveyTotal,
        waiting: Boolean(unansweredQuestion(data, student.id)),
        stale: (daysAgo(student.lastActive) || 0) >= 7 && student.status !== "paused",
      };
    });

    const activeRules = rules.filter((rule) => {
      if (rule.operator === "is_empty" || rule.operator === "is_not_empty") return true;
      return (rule.values || []).some((value) => value.trim());
    });

    const filtered = enriched.filter((row) => {
      const { student } = row;
      if (query) {
        const haystack = [student.name, student.email, student.phone || ""].join(" ").toLowerCase();
        if (!haystack.includes(query)) return false;
      } else if (student.accessActive === false && !showInactiveOnRoster(search)) {
        const asksClosed = activeRules.some(
          (rule) => rule.field === "courseAccess" && (rule.values || []).includes("deregistered")
        );
        if (!asksClosed) return false;
      }
      if (!activeRules.length) return true;
      const matches = activeRules.map((rule) => matchRosterRule(student, rule));
      return logic === "or" ? matches.some(Boolean) : matches.every(Boolean);
    });

    const direction = sortDir === "asc" ? 1 : -1;
    return filtered.sort((a, b) => {
      const left = sortValue(a, sortKey);
      const right = sortValue(b, sortKey);
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return compareText(String(left), String(right)) * direction;
    });
  }, [accessPatch, data, lessonIds, logic, rules, search, sortDir, sortKey, students, submissionCounts, surveyCounts, surveyTotal]);

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

  const notifyStudents = () => {
    const picked = selected.length
      ? students.filter((student) => selected.includes(student.id)).map((student) => ({ ...student, ...accessPatch[student.id] }))
      : rows.map((row) => row.student);
    if (!picked.length) return;
    setOpenMenu(null);
    setNotifyDraft({
      audience: selected.length ? "selected" : "filtered",
      audienceLabel: labelForGroup(data, picked, selected.length ? "selected" : "filtered", selected.length ? undefined : "Roster"),
      recipientIds: picked.map((student) => student.id),
    });
  };

  const applyRegistration = async (action: "deregister" | "set_expiry") => {
    if (!selected.length) {
      setActionNotice("Tick the students first.");
      return;
    }
    if (action === "set_expiry" && !bulkExpiresOn) {
      setActionNotice("Choose an expiry date.");
      return;
    }
    setActionBusy(action);
    setActionNotice("");
    const response = await fetch("/api/coach/registration", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        user_ids: selected,
        action,
        expires_on: bulkExpiresOn,
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    setActionBusy("");
    if (!response.ok) {
      setActionNotice(payload.error || "Could not update course access.");
      return;
    }
    const next =
      action === "deregister"
        ? { accessActive: false, deregisteredAt: new Date().toISOString() }
        : {
            accessActive: !isCourseAccessClosed({ accessExpiresOn: bulkExpiresOn, deregisteredAt: null }),
            accessExpiresOn: bulkExpiresOn,
            deregisteredAt: null,
          };
    setAccessPatch((current) => {
      const patch = { ...current };
      selected.forEach((id) => {
        patch[id] = { ...patch[id], ...next };
      });
      return patch;
    });
    setActionNotice(
      action === "deregister"
        ? `${selected.length} student${selected.length === 1 ? "" : "s"} deregistered. Search to find them again.`
        : `Expiry set for ${selected.length} student${selected.length === 1 ? "" : "s"}.`
    );
    setOpenMenu(null);
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
      rows.map((row) => visible.map((id) => plainCell(id, row, row.submitted)))
    );
  };

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>Student roster</h2>
          <p className="muted small">
            {search.trim()
              ? `${rows.length} of ${students.length} student${students.length === 1 ? "" : "s"}`
              : `${rows.length} active student${rows.length === 1 ? "" : "s"}`}{" "}
            · click a name for the profile, or use Actions for a selection
          </p>
          {actionNotice ? <p className="muted small">{actionNotice}</p> : null}
        </div>
        <div className="actions" ref={actionsRef}>
          <div className="roster-menu">
            <button
              className="primary roster-menu-btn"
              type="button"
              aria-expanded={openMenu === "actions"}
              onClick={() => setOpenMenu(openMenu === "actions" ? null : "actions")}
            >
              Actions
            </button>
            {openMenu === "actions" ? (
              <div className="roster-menu-panel roster-actions-panel">
                <button className="ghost roster-action-item" type="button" disabled={!rows.length && !selected.length} onClick={notifyStudents}>
                  Notify
                </button>
                <button className="ghost roster-action-item" type="button" disabled={!rows.length} onClick={() => { exportCsv(); setOpenMenu(null); }}>
                  Export
                </button>
                <button
                  className="ghost roster-action-item"
                  type="button"
                  disabled={!selected.length || Boolean(actionBusy)}
                  onClick={() => void applyRegistration("deregister")}
                >
                  {actionBusy === "deregister" ? "Deregistering…" : "Deregister"}
                </button>
                <div className="roster-action-expiry">
                  <label className="student-notes-label" htmlFor="roster-bulk-expiry">
                    Set expiry date
                  </label>
                  <div className="student-access-row">
                    <input
                      id="roster-bulk-expiry"
                      type="date"
                      className="select-line"
                      value={bulkExpiresOn}
                      onChange={(event) => setBulkExpiresOn(event.target.value)}
                    />
                    <button
                      className="ghost"
                      type="button"
                      disabled={!selected.length || !bulkExpiresOn || Boolean(actionBusy)}
                      onClick={() => void applyRegistration("set_expiry")}
                    >
                      {actionBusy === "set_expiry" ? "Saving…" : "Apply"}
                    </button>
                  </div>
                </div>
                {actionNotice ? <p className="muted small">{actionNotice}</p> : null}
              </div>
            ) : null}
          </div>
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

      <RosterFilterBuilder
        rules={rules}
        logic={logic}
        optionsByField={optionsByField}
        onChangeRules={setRules}
        onChangeLogic={setLogic}
        onAddRule={() => setRules((current) => [...current, newRosterFilterRule()])}
      />

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
                    <td key={id}>{cellFor(id, row, row.submitted)}</td>
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
      return (
        <span className="roster-name-access">
          <strong>
            <StudentProfileLink studentId={student.id}>{student.name}</StudentProfileLink>
          </strong>
          <CourseAccessBadge access={student.courseAccess} accessActive={student.accessActive} />
          <AccountActivationBadge status={student.accountActivation} />
        </span>
      );
    case "courseAccess":
      return <CourseAccessBadge access={student.courseAccess} accessActive={student.accessActive} />;
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
        <span className={`badge ${accountStatusLabel(student) === "Active" ? "ok" : "warn"}`}>
          {accountStatusLabel(student)}
        </span>
      );
    case "submitted":
      return (
        <span className="muted small">
          {row.submitted}
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
