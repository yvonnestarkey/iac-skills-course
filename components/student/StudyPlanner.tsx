"use client";

import { useEffect, useMemo, useState } from "react";
import AdjustPanel from "@/components/planner/AdjustPanel";
import { DAYS, DEFAULT_PLAN, ICONS, PERIODS } from "@/lib/constants";
import { isoDate, longDate, today } from "@/lib/dates";
import { planCapacity, planStatus, sortSlots } from "@/lib/planner";
import { SEED } from "@/lib/seed";
import { clearStudyPlan, fetchStudyPlan, saveStudyPlan } from "@/lib/student-plan";
import { useStudentSession } from "@/lib/student-session";
import type { Student, StudyPlan } from "@/lib/types";

function emptyPlan(): StudyPlan {
  return {
    startDate: isoDate(today()),
    hours: DEFAULT_PLAN.hours,
    slots: [...DEFAULT_PLAN.slots],
    makeups: [],
  };
}

export default function StudyPlanner() {
  const { user, completed } = useStudentSession();
  const [draft, setDraft] = useState<StudyPlan>(emptyPlan);
  const [saved, setSaved] = useState(false);
  const [adjust, setAdjust] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchStudyPlan(user.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStatus(result.error || "Could not load your study plan.");
        return;
      }
      if (result.plan) {
        setDraft(result.plan);
        setSaved(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const student: Student | null = useMemo(() => {
    if (!user) return null;
    const doneIds = Object.entries(completed)
      .filter(([, done]) => done)
      .map(([id]) => id);
    const submissions: Record<string, string> = {};
    doneIds.forEach((id) => {
      submissions[id] = "Completed";
    });
    return {
      id: user.id,
      name: user.email || "Student",
      email: user.email || "",
      cohort: "autumn26",
      status: "active",
      completed: doneIds,
      submissions,
      plan: draft,
    };
  }, [user, completed, draft]);

  const schedule = student ? planStatus(SEED, student, draft) : null;

  const change = (next: Partial<StudyPlan>) => setDraft((current) => ({ ...current, ...next }));
  const toggleSlot = (id: string, on: boolean) => {
    change({ slots: on ? [...draft.slots, id] : draft.slots.filter((slot) => slot !== id) });
  };

  const save = async () => {
    if (!user) return;
    const plan: StudyPlan = {
      startDate: draft.startDate,
      hours: Math.max(0.5, Number(draft.hours) || 1),
      slots: sortSlots(draft.slots),
      makeups: draft.makeups.map((item) => ({ ...item })),
    };
    setBusy(true);
    setStatus("");
    const result = await saveStudyPlan(user.id, plan);
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not save your plan. Run the study_plans SQL in Supabase if this table is new.");
      return;
    }
    setDraft(plan);
    setSaved(true);
    setStatus("Plan saved. Your target dates will stay with this account.");
  };

  const clear = async () => {
    if (!user) return;
    setBusy(true);
    const result = await clearStudyPlan(user.id);
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not clear your plan.");
      return;
    }
    setDraft(emptyPlan());
    setSaved(false);
    setStatus("Saved plan cleared.");
  };

  if (!user) return null;

  return (
    <section className="student-planner" id="study-planner">
      <div className="plan-field">
        <label htmlFor="student-start">
          <strong>Study start date</strong>
        </label>
        <input
          id="student-start"
          type="date"
          className="select-line"
          value={draft.startDate}
          onChange={(event) => change({ startDate: event.target.value || isoDate(today()) })}
        />
      </div>
      <div className="plan-field">
        <label htmlFor="student-hours">
          <strong>Hours available per week</strong>
        </label>
        <div className="hours-row">
          <input
            id="student-hours"
            type="number"
            min={1}
            max={40}
            step={0.5}
            value={draft.hours}
            onChange={(event) => change({ hours: Number(event.target.value) || 1 })}
          />
          <span className="muted small">hours per week</span>
        </div>
      </div>
      <div className="plan-field">
        <label>
          <strong>When can you study?</strong>
        </label>
        <div className="slot-grid">
          {DAYS.map((day) => (
            <div className="slot-day" key={day.id}>
              <span className="slot-day-label">{day.label}</span>
              {PERIODS.map((period) => {
                const id = `${day.id}-${period.id}`;
                const on = draft.slots.includes(id);
                return (
                  <label className={`slot ${on ? "on" : ""}`} key={id}>
                    <input type="checkbox" checked={on} onChange={(event) => toggleSlot(id, event.target.checked)} />
                    <span>{period.label}</span>
                  </label>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="actions">
        <button className="primary" type="button" disabled={busy} onClick={save}>
          Save my plan
        </button>
        {saved ? (
          <button className="ghost" type="button" disabled={busy} onClick={clear}>
            Clear saved plan
          </button>
        ) : null}
        <button className="ghost" type="button" onClick={() => setAdjust((open) => !open)}>
          {adjust ? "Hide Adjust me" : "Adjust me"}
        </button>
      </div>
      {status ? <p className="notice">{status}</p> : null}
      {adjust ? <AdjustPanel draft={draft} onChange={change} /> : null}
      {schedule && schedule.finish ? (
        <div className="plan-summary">
          At {Math.max(0.5, Number(draft.hours) || 1)} hours a week you finish on{" "}
          <strong>{longDate(schedule.finish)}</strong>. Sessions are capped at {planCapacity(draft)} minutes.
          {schedule.overdue.length
            ? ` You are ${schedule.overdue.length} item${schedule.overdue.length === 1 ? "" : "s"} behind.`
            : ""}
        </div>
      ) : null}
      {schedule && schedule.cells.length ? (
        <ol className="student-plan-upcoming">
          {schedule.cells.slice(0, 6).map((cell) => (
            <li key={`${isoDate(cell.date)}-${cell.period}`}>
              <strong>
                {longDate(cell.date)} · {cell.period}
              </strong>
              <span className="muted small">
                {cell.items
                  .map((item) => `${ICONS[item.lesson.type] || ""} ${item.lesson.title}`)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty">Pick at least one session and save to see your dated schedule.</p>
      )}
    </section>
  );
}
