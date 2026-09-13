"use client";

import { useState } from "react";
import { isoDate, longDate, parseISO, shiftISO, today } from "@/lib/dates";
import type { MakeupSession, StudyPlan } from "@/lib/types";

interface Props {
  draft: StudyPlan;
  onChange: (next: Partial<StudyPlan>) => void;
}

export default function AdjustPanel({ draft, onChange }: Props) {
  const [date, setDate] = useState(shiftISO(2));
  const [period, setPeriod] = useState<"morning" | "evening">("evening");
  const [minutes, setMinutes] = useState("90");

  const addMakeup = () => {
    if (!date) return;
    const session: MakeupSession = { date, period, minutes: Math.max(20, Number(minutes) || 90) };
    onChange({ makeups: [...draft.makeups, session] });
  };

  const catchUp = () => {
    const extra = [...draft.makeups];
    [2, 3].forEach((offset) => {
      const iso = shiftISO(offset);
      if (!extra.some((m) => m.date === iso)) extra.push({ date: iso, period: "evening", minutes: 90 });
    });
    onChange({ makeups: extra });
  };

  return (
    <section className="card adjust-panel">
      <h3>Adjust me</h3>
      <p className="muted small">Quick changes to catch up without rebuilding the plan from scratch.</p>
      <div className="adjust-actions">
        <button className="ghost" id="adj-today" onClick={() => onChange({ startDate: isoDate(today()) })}>
          Move start to today
        </button>
        <button
          className="ghost"
          id="adj-hour"
          onClick={() => onChange({ hours: Math.round((Number(draft.hours) + 1) * 10) / 10 })}
        >
          Add an hour a week
        </button>
        <button className="ghost" id="adj-catchup" onClick={catchUp}>
          Add 2 make-up sessions
        </button>
      </div>
      <h4>Make-up sessions</h4>
      {draft.makeups.length ? (
        <ul className="makeup-list">
          {draft.makeups.map((m, i) => (
            <li key={`${m.date}-${m.period}-${i}`}>
              <span>
                {longDate(parseISO(m.date))} · {m.period} · {m.minutes} min
              </span>
              <button
                className="link-btn"
                onClick={() => onChange({ makeups: draft.makeups.filter((_, index) => index !== i) })}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small">No make-up sessions yet.</p>
      )}
      <div className="makeup-add">
        <input type="date" id="makeup-date" value={date} onChange={(event) => setDate(event.target.value)} />
        <select
          id="makeup-period"
          value={period}
          onChange={(event) => setPeriod(event.target.value as "morning" | "evening")}
        >
          <option value="morning">morning</option>
          <option value="evening">evening</option>
        </select>
        <input
          type="number"
          id="makeup-min"
          min={20}
          max={240}
          step={10}
          value={minutes}
          onChange={(event) => setMinutes(event.target.value)}
        />
        <button className="ghost" id="add-makeup" onClick={addMakeup}>
          Add session
        </button>
      </div>
    </section>
  );
}
