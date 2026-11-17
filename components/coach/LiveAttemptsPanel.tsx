"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { formatSastDateTime } from "@/lib/dates";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import { LIVE, gradeBand, getExercise, type DrillAttempt } from "@/lib/reading-drills";

type LiveAttemptRow = {
  id: string;
  exercise_id: string;
  email: string;
  pct: number;
  pot_pct: number;
  marked_by: string;
  created_at: string;
  attempt: DrillAttempt;
  student: { id: string; name: string } | null;
};


/** Coach view of the open live-session link: who did it, how it went, and which course account the email matches. */
export default function LiveAttemptsPanel() {
  const [rows, setRows] = useState<LiveAttemptRow[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [exercise, setExercise] = useState("");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/coach/live-attempts${exercise ? `?exercise=${encodeURIComponent(exercise)}` : ""}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "Could not load live attempts.");
        setRows(d.attempts || []);
        setError("");
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [exercise]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter((r) => r.email.includes(q) || r.student?.name.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const csv = () => {
    const head = ["date", "exercise", "email", "matched student", "result range", "potential range", "marked by", "reading wpm", "recall", "rows earned", "answer"];
    const lines = shown.map((r) => [
      r.created_at, r.exercise_id, r.email, r.student?.name || "", gradeBand(r.pct).label, gradeBand(r.pot_pct).label, r.marked_by,
      r.attempt.wpm, `${r.attempt.recall}/${r.attempt.recall_n}`, (r.attempt.rows_earned || []).join(" "), r.attempt.answer,
    ].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `live-attempts${exercise ? `-${exercise}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack">
      <p className="muted small">
        Share links:{" "}
        {LIVE.exercises.map((id, i) => (
          <span key={id}>
            {i ? " · " : ""}
            <code>https://iac.accountingstudyadvice.com/live/{id}</code>
          </span>
        ))}
      </p>
      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
        <select value={exercise} onChange={(e) => setExercise(e.target.value)}>
          <option value="">All live exercises</option>
          {LIVE.exercises.map((id) => (
            <option key={id} value={id}>{getExercise(id)?.title || id}</option>
          ))}
        </select>
        <input type="search" placeholder="Search email or name" value={search} onChange={(e) => setSearch(e.target.value)} />
        <button type="button" onClick={csv} disabled={!shown.length}>Download CSV</button>
      </div>
      {error ? <p className="notice">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}
      {!loading && !error && !shown.length ? <p className="muted">No live attempts yet.</p> : null}
      {shown.length ? (
        <table className="data-table">
          <thead>
            <tr><th>When</th><th>Email</th><th>Course account</th><th>Exercise</th><th>Result range</th><th>Marked</th><th /></tr>
          </thead>
          <tbody>
            {shown.map((r) => {
              const ex = getExercise(r.exercise_id);
              const a = r.attempt;
              return (
                <Fragment key={r.id}>
                  <tr>
                    <td>{formatSastDateTime(r.created_at)}</td>
                    <td>{r.email}</td>
                    <td>
                      {r.student ? <StudentProfileLink studentId={r.student.id}>{r.student.name}</StudentProfileLink> : <span className="muted">No match</span>}
                    </td>
                    <td>{ex?.title || r.exercise_id}</td>
                    <td>
                      {gradeBand(r.pct).label}
                      {r.pot_pct > r.pct ? <div className="muted small">could have been {gradeBand(r.pot_pct).label}</div> : null}
                    </td>
                    <td>{r.marked_by === "model" ? "AI" : "Self"}</td>
                    <td><button type="button" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? "Hide" : "Answer"}</button></td>
                  </tr>
                  {open === r.id ? (
                    <tr>
                      <td colSpan={7}>
                        <p className="small">
                          Reading {a.wpm} words a minute · recall {a.recall}/{a.recall_n} · {a.notes?.filter((n) => !n.crossed).length ?? 0} notes ·
                          RTFQ delivered: Shape {a.rtfq_delivered?.shape}, Directions {a.rtfq_delivered?.dir}, Lens {a.rtfq_delivered?.lens} ·
                          Direct rows {a.buried_treasure?.dEarn}/{a.buried_treasure?.dRows}, Indirect rows {a.buried_treasure?.iEarn}/{a.buried_treasure?.iRows}
                        </p>
                        <p className="small"><b>Rows earned:</b> {(a.rows_earned || []).join(", ") || "none"}</p>
                        {a.fix ? <p className="small"><b>Fix this first:</b> {a.fix}</p> : null}
                        <div className="small" style={{ whiteSpace: "pre-wrap", borderLeft: "3px solid var(--line)", paddingLeft: 10 }}>{a.answer}</div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
