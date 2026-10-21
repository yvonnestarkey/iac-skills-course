"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { COURSE_COHORTS, displayCohortName, normalizeCohortId } from "@/lib/cohorts";
import { formatUsdCents } from "@/lib/format-money";
import { MONTHS } from "@/lib/dates";
import {
  contributionKindLabel,
  isTestStudentEmail,
  optionLabel,
  rollupRevenueMonthRows,
  sortRevenueRows,
  totalRevenueRow,
  type RevenueContributionKind,
  type RevenueMonthRow,
  type RevenueSortKey,
  type RevenueStatement,
} from "@/lib/revenue-report";

type Payload = {
  months: RevenueMonthRow[];
  total: RevenueMonthRow;
  statements: RevenueStatement[];
};

const SORT_LABELS: { key: RevenueSortKey; label: string }[] = [
  { key: "month", label: "Month" },
  { key: "paying_students", label: "Enrolments" },
  { key: "sales_cents", label: "Sales" },
  { key: "installments_paid_cents", label: "Instalments paid" },
  { key: "installments_due_cents", label: "Instalments due" },
  { key: "referrals_paid_cents", label: "Ref paid" },
  { key: "referrals_due_cents", label: "Ref due" },
  { key: "cash_cents", label: "Cash" },
];

const DRILL_KINDS: RevenueContributionKind[] = [
  "sale",
  "installment_paid",
  "installment_due",
  "cash",
  "referral_paid",
  "referral_due",
];

function money(cents: number) {
  return formatUsdCents(cents);
}

function monthLabel(key: string) {
  if (key === "total") return "Total cohort";
  const [year, month] = key.split("-");
  const index = Number(month) - 1;
  if (!year || index < 0 || index > 11) return key;
  return `${MONTHS[index]} ${year}`;
}

function formatWhen(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { dateStyle: "medium", timeZone: "Africa/Johannesburg" });
}

export default function RevenueReportPage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState("");
  const [cohort, setCohort] = useState("all");
  const [month, setMonth] = useState("all");
  const [sortKey, setSortKey] = useState<RevenueSortKey>("month");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [drillMonth, setDrillMonth] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/coach/revenue")
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Could not load revenue.");
        setData(payload);
      })
      .catch((item) => setError(item instanceof Error ? item.message : "Could not load revenue."));
  }, []);

  const statements = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.statements.filter((row) => {
      if (isTestStudentEmail(row.email)) return false;
      if (cohort !== "all" && normalizeCohortId(row.cohort) !== cohort) return false;
      if (month !== "all" && !row.months.includes(month)) return false;
      if (!query) return true;
      return `${row.name} ${row.email}`.toLowerCase().includes(query);
    });
  }, [data, cohort, month, search]);

  const monthRows = useMemo(() => {
    const source = rollupRevenueMonthRows(statements.flatMap((row) => row.month_rows || []));
    const filtered = month === "all" ? source : source.filter((row) => row.month === month);
    return sortRevenueRows(filtered, sortKey, sortDir).concat(filtered.length ? [totalRevenueRow(filtered)] : []);
  }, [statements, month, sortKey, sortDir]);

  const open = statements.find((row) => row.user_id === openId) || null;
  const monthOptions = [...new Set(statements.flatMap((row) => row.months))].sort();

  const openStatement = (userId: string, scroll = false) => {
    setOpenId((current) => (current === userId && !scroll ? null : userId));
    if (!scroll) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`student-row-${userId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };
  const drillRows = drillMonth
    ? statements
        .flatMap((row) => row.contributions || [])
        .filter((row) => row.month === drillMonth)
        .sort((a, b) => a.name.localeCompare(b.name || "") || a.kind.localeCompare(b.kind) || a.date.localeCompare(b.date))
    : [];

  const toggleSort = (key: RevenueSortKey) => {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(key === "month" ? "asc" : "desc");
  };

  return (
    <div className="coach-page">
      <button className="back-link revenue-no-print" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <section className="card revenue-no-print">
        <p className="kicker">Coach tools</p>
        <h1>Revenue</h1>
        <p className="muted">
          Only completed purchases count, not abandoned checkouts. Enrolments is who bought that month — later instalment
          months stay at 0, and the total is unique buyers, not 2 + 8. Sales is the course price they bought. Cash is the
          money due that SAST month. Click a month to see the lines. Addresses containing @test are left out.
        </p>
        {error ? <p className="student-auth-error">{error}</p> : null}
        {!data && !error ? <p className="empty">Loading revenue…</p> : null}
        {data ? (
          <div className="revenue-toolbar">
            <label>
              <span className="muted small">Cohort</span>
              <select className="select-line" value={cohort} onChange={(event) => setCohort(event.target.value)}>
                <option value="all">All cohorts</option>
                {COURSE_COHORTS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted small">Month</span>
              <select className="select-line" value={month} onChange={(event) => setMonth(event.target.value)}>
                <option value="all">All months</option>
                {monthOptions.map((value) => (
                  <option key={value} value={value}>
                    {monthLabel(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="muted small">Find a student</span>
              <input
                className="select-line"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name or email"
              />
            </label>
          </div>
        ) : null}
      </section>

      {data ? (
        <section className="card revenue-no-print">
          <h2>Monthly cash</h2>
          <table className="data-table roster">
            <thead>
              <tr>
                {SORT_LABELS.map((column) => (
                  <th key={column.key}>
                    <button className="roster-sort" type="button" onClick={() => toggleSort(column.key)}>
                      {column.label}
                      {sortKey === column.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {monthRows.length ? (
                monthRows.map((row) => (
                  <tr
                    key={row.month}
                    className={row.month === "total" ? "revenue-total-row" : drillMonth === row.month ? "revenue-month-open" : undefined}
                    onClick={() => {
                      if (row.month === "total") return;
                      setDrillMonth((current) => (current === row.month ? null : row.month));
                    }}
                  >
                    <td>
                      <strong>{monthLabel(row.month)}</strong>
                      {row.month !== "total" ? <span className="cell-sub">{drillMonth === row.month ? "Close" : "Open"}</span> : null}
                    </td>
                    <td>{row.paying_students}</td>
                    <td>{money(row.sales_cents)}</td>
                    <td>{money(row.installments_paid_cents)}</td>
                    <td>{money(row.installments_due_cents)}</td>
                    <td>{money(row.referrals_paid_cents)}</td>
                    <td>{money(row.referrals_due_cents)}</td>
                    <td>
                      <strong>{money(row.cash_cents)}</strong>
                    </td>
                  </tr>
                ))
              ) : (
                <tr className="roster-empty">
                  <td colSpan={8}>No sales in that filter.</td>
                </tr>
              )}
            </tbody>
          </table>
          {drillMonth ? (
            <div className="revenue-drill">
              <h3>{monthLabel(drillMonth)} detail</h3>
              <p className="muted small">Every line that makes up the totals for this month.</p>
              {DRILL_KINDS.map((kind) => {
                const rows = drillRows.filter((row) => row.kind === kind);
                if (!rows.length) return null;
                const sum = rows.reduce((total, row) => total + row.amount_cents, 0);
                return (
                  <div key={kind} className="revenue-drill-block">
                    <p>
                      <strong>{contributionKindLabel(kind)}</strong>
                      <span className="muted small"> · {money(sum)}</span>
                    </p>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Student</th>
                          <th>Item</th>
                          <th>Status</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, index) => (
                          <tr key={`${row.user_id}-${row.kind}-${row.date}-${index}`} onClick={() => openStatement(row.user_id, true)}>
                            <td>{row.name}</td>
                            <td>{row.label}</td>
                            <td>{row.status}</td>
                            <td>{money(row.amount_cents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
              {!drillRows.length ? <p className="empty">No lines in this month for the current filter.</p> : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {data ? (
        <section className="card">
          <div className="revenue-no-print">
            <h2>Student statements</h2>
            <p className="muted small">Open a student on their row to print or save their statement.</p>
          </div>
          <table className="data-table roster">
            <thead className="revenue-no-print">
              <tr>
                <th>Student</th>
                <th>Plan</th>
                <th>Paid</th>
                <th>Due</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {statements.length ? (
                statements.map((row) => (
                  <Fragment key={row.user_id}>
                    <tr
                      id={`student-row-${row.user_id}`}
                      className={openId === row.user_id ? "revenue-student-open" : "revenue-no-print"}
                      onClick={() => openStatement(row.user_id)}
                    >
                      <td>
                        <strong>{row.name}</strong>
                        <span className="cell-sub">{row.email || displayCohortName(row.cohort)}</span>
                      </td>
                      <td>{optionLabel(row.option)}</td>
                      <td>{money(row.paid_cents)}</td>
                      <td>{money(row.due_cents)}</td>
                      <td>
                        <button className="ghost" type="button">
                          {openId === row.user_id ? "Close" : "Statement"}
                        </button>
                      </td>
                    </tr>
                    {open && open.user_id === row.user_id ? (
                      <tr className="revenue-statement-row" onClick={(event) => event.stopPropagation()}>
                        <td colSpan={5}>
                          <div className="revenue-statement-embed" aria-label={`${open.name} statement`}>
                            <div className="panel-head">
                              <div>
                                <p className="kicker">Student statement</p>
                                <h2>{open.name}</h2>
                                <p className="muted small">
                                  {open.email}
                                  {open.cohort ? ` · ${displayCohortName(open.cohort)}` : ""}
                                </p>
                              </div>
                              <div className="actions revenue-no-print">
                                <button className="ghost" type="button" onClick={() => setOpenId(null)}>
                                  Close
                                </button>
                                <button className="primary" type="button" onClick={() => window.print()}>
                                  Print statement
                                </button>
                              </div>
                            </div>
                            <p>
                              {optionLabel(open.option)} · {open.purchase_status} · Paid {money(open.paid_cents)} · Due{" "}
                              {money(open.due_cents)}
                              {open.discount_cents
                                ? ` · ${open.discount_label || "Referral discount"} ${money(open.discount_cents)}`
                                : ""}
                            </p>
                            <table className="data-table">
                              <thead>
                                <tr>
                                  <th>Date</th>
                                  <th>Item</th>
                                  <th>Status</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {open.lines.map((line, index) => (
                                  <tr key={`${line.date}-${line.label}-${index}`}>
                                    <td>{formatWhen(line.date)}</td>
                                    <td>{line.label}</td>
                                    <td>{line.status}</td>
                                    <td>{money(line.amount_cents)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))
              ) : (
                <tr className="roster-empty">
                  <td colSpan={5}>No student statements in that filter.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
