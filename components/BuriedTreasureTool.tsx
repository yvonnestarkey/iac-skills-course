"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BURIED_TREASURE_TIERS,
  buriedTreasureTag,
  fetchOwnBuriedTreasure,
  pctOf,
  saveBuriedTreasureSession,
  type BuriedTreasureTierId,
} from "@/lib/buried-treasure";
import { useStudentSession } from "@/lib/student-session";

type Drafts = Record<BuriedTreasureTierId, string>;

const EMPTY: Drafts = { tier1: "", tier2: "", tier3: "" };

export default function BuriedTreasureTool() {
  const { user } = useStudentSession();
  const [drafts, setDrafts] = useState<Drafts>(EMPTY);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  useEffect(() => {
    if (!user?.id) return;
    fetchOwnBuriedTreasure(user.id).then((log) => {
      if (!log) return;
      setDrafts({
        tier1: String(log.tier1_earned),
        tier2: String(log.tier2_earned),
        tier3: String(log.tier3_earned),
      });
      setNotes(log.notes);
    });
  }, [user?.id]);

  const rows = useMemo(
    () =>
      BURIED_TREASURE_TIERS.map((tier) => {
        const raw = drafts[tier.id];
        const earned = raw === "" ? null : Number(raw);
        const conversion = earned == null || Number.isNaN(earned) ? null : pctOf(earned, tier.available);
        return {
          ...tier,
          earned,
          conversion,
          tag: buriedTreasureTag(tier.id, conversion),
        };
      }),
    [drafts]
  );

  const submit = async () => {
    if (!user?.id) return;
    for (const row of rows) {
      if (row.earned == null || Number.isNaN(row.earned)) {
        setError(`Enter Marks You Got for ${row.name}.`);
        return;
      }
      if (row.earned > row.available) {
        setError(`${row.name} is ${row.available} available marks. Marks You Got cannot exceed that ceiling.`);
        return;
      }
    }
    setBusy(true);
    setError("");
    setSaved("");
    const result = await saveBuriedTreasureSession({
      userId: user.id,
      tier1_earned: rows[0].earned || 0,
      tier2_earned: rows[1].earned || 0,
      tier3_earned: rows[2].earned || 0,
      notes: notes.trim(),
    });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setSaved("Saved Buried Treasure session.");
  };

  return (
    <article className="lesson-body wide eval-page">
      <p>
        <Link href="/student/evaluator">← Script evaluator</Link>
      </p>
      <p className="kicker">Tool 3</p>
      <h1>Tool 3: Buried Treasure</h1>
      <p className="muted">
        Measure how effectively you extract value from the case study across Direct, Indirect, and Thinking marks.
      </p>
      <form
        className="eval-form va-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="va-table-wrap">
          <table className="va-table bt-table">
            <thead>
              <tr>
                <th scope="col">Mark Tier &amp; Definition</th>
                <th scope="col">Exam Weight</th>
                <th scope="col">Target Benchmark (%)</th>
                <th scope="col">Available Marks</th>
                <th scope="col">Marks You Got</th>
                <th scope="col">Conversion %</th>
                <th scope="col">Diagnostic Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th scope="row">
                    <strong>{row.name}</strong>
                    <span className="muted small">{row.definition}</span>
                  </th>
                  <td>{row.weight}</td>
                  <td>≥ {row.benchmark}%</td>
                  <td>{row.available}</td>
                  <td>
                    <input
                      type="number"
                      min={0}
                      max={row.available}
                      step="0.5"
                      value={drafts[row.id]}
                      onChange={(event) => setDrafts((prev) => ({ ...prev, [row.id]: event.target.value }))}
                      aria-label={`${row.name} Marks You Got`}
                    />
                  </td>
                  <td>{row.conversion == null ? "—" : `${row.conversion}%`}</td>
                  <td>{row.tag || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <label className="eval-notes">
          Notes
          <textarea
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Where did extraction or execution leak in the case study?"
          />
        </label>
        {error ? <p className="notice">{error}</p> : null}
        {saved ? <p className="muted">{saved}</p> : null}
        <div className="actions">
          <button className="primary" type="submit" disabled={busy || !user?.id}>
            {busy ? "Saving…" : "Save Session"}
          </button>
        </div>
      </form>
      <div className="actions va-continue">
        <Link href="/student/evaluator/report" className="primary">
          Continue Script Evaluation
        </Link>
      </div>
    </article>
  );
}
