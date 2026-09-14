"use client";

import { useState } from "react";
import { DAYS, DEFAULT_PLAN, PERIODS } from "@/lib/constants";
import { isoDate, today } from "@/lib/dates";
import { countEvents, feedStamp, feedToken, feedUrls } from "@/lib/ics";
import { buildIcs } from "@/lib/calendarSync";
import { sortSlots } from "@/lib/planner";
import { useStore } from "@/lib/store";
import type { StudyPlan } from "@/lib/types";
import AdjustPanel from "./AdjustPanel";
import ScheduleView from "./ScheduleView";
import SubscribeCard from "./SubscribeCard";

export default function PlannerView() {
  const { data, student, mutate, notice, setNotice, plannerAdjust, setPlannerAdjust } = useStore();
  const saved = student ? student.plan : null;
  const [draft, setDraft] = useState<StudyPlan>({
    startDate: saved && saved.startDate ? saved.startDate : isoDate(today()),
    hours: saved ? saved.hours : DEFAULT_PLAN.hours,
    slots: saved ? [...saved.slots] : [...DEFAULT_PLAN.slots],
    makeups: saved && saved.makeups ? saved.makeups.map((m) => ({ ...m })) : [],
  });

  if (!student) return null;

  const change = (next: Partial<StudyPlan>) => setDraft((current) => ({ ...current, ...next }));

  const toggleSlot = (id: string, on: boolean) => {
    change({ slots: on ? [...draft.slots, id] : draft.slots.filter((s) => s !== id) });
  };

  /** Publish the finished .ics to the feed route so subscribers pick it up. */
  const publish = async (plan: StudyPlan, silent = false) => {
    const token = feedToken(student);
    const ics = buildIcs(data, { ...student, calendar: { ...(student.calendar || {}), token } }, plan);
    try {
      const res = await fetch(feedUrls(token).http, {
        method: "PUT",
        headers: { "Content-Type": "text/calendar" },
        body: ics,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      mutate((draftData) => {
        const target = draftData.students.find((s) => s.id === student.id);
        target.calendar = { token, subscribed: true, updatedAt: feedStamp(), events: countEvents(ics) };
      });
      if (!silent) setNotice("Calendar feed published. Subscribe once and it stays up to date.");
      return true;
    } catch {
      mutate((draftData) => {
        const target = draftData.students.find((s) => s.id === student.id);
        target.calendar = { ...(target.calendar || {}), token, failed: true };
      });
      setNotice(
        "Could not reach the feed service, so subscribing is unavailable. Check the app is running and try again, or use Download Planner instead."
      );
      return false;
    }
  };

  const savePlan = async () => {
    const plan: StudyPlan = {
      startDate: draft.startDate,
      hours: Math.max(0.5, Number(draft.hours) || 1),
      slots: sortSlots(draft.slots),
      makeups: draft.makeups.map((m) => ({ ...m })),
    };
    mutate((draftData) => {
      const target = draftData.students.find((s) => s.id === student.id);
      target.plan = plan;
    });
    if (student.calendar && student.calendar.subscribed) {
      setNotice("Plan saved. Republishing your calendar feed…");
      const okay = await publish(plan, true);
      if (okay) setNotice("Plan saved and your subscribed calendar updated.");
      return;
    }
    setNotice("Plan saved. It shows in your sidebar and you can adjust it any time.");
  };

  const clearPlan = () => {
    mutate((draftData) => {
      const target = draftData.students.find((s) => s.id === student.id);
      delete target.plan;
    });
    setDraft({
      startDate: isoDate(today()),
      hours: DEFAULT_PLAN.hours,
      slots: [...DEFAULT_PLAN.slots],
      makeups: [],
    });
    setNotice("");
  };

  const stopFeed = () => {
    const token = student.calendar.token;
    fetch(feedUrls(token).http, { method: "DELETE" }).catch(() => {});
    mutate((draftData) => {
      const target = draftData.students.find((s) => s.id === student.id);
      target.calendar = { token, subscribed: false };
    });
    setNotice("Feed stopped. Remove the subscription in your calendar app too.");
  };

  const download = () => {
    const ics = buildIcs(data, student, draft);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "iac-skills-study-plan.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setNotice("Planner downloaded. Import iac-skills-study-plan.ics into Google Calendar, Outlook, or Apple Calendar.");
  };

  const subscribed = Boolean(student.calendar && student.calendar.subscribed);

  return (
    <>
      <div className="plan-hero">
        <p className="kicker-light">Personalised study planner</p>
        <h1>Create My Study Plan</h1>
        <p>
          Set your start date and the sessions you can keep. We date the whole course — every video, reading,
          assignment, and upload — so you can see exactly when you finish.
        </p>
        <div className="plan-hero-actions">
          <button className="download-btn" id="subscribe-plan" onClick={() => publish(draft)}>
            {subscribed ? "↻ Update my calendar feed" : "🗓 Subscribe to calendar"}
          </button>
          <button className="hero-ghost" id="download-plan" onClick={download}>
            ⤓ Download Planner
          </button>
          <button className="hero-ghost" id="toggle-adjust" onClick={() => setPlannerAdjust(!plannerAdjust)}>
            {plannerAdjust ? "Hide Adjust me" : "Adjust me"}
          </button>
        </div>
      </div>
      <div className="plan-page">
        <div className="plan-left">
          <SubscribeCard student={student} onStop={stopFeed} />
          <section className="card plan-form">
            <div className="plan-field">
              <label htmlFor="start">
                <strong>Study start date</strong>
              </label>
              <input
                id="start"
                type="date"
                className="select-line"
                value={draft.startDate}
                onChange={(event) => change({ startDate: event.target.value || isoDate(today()) })}
              />
            </div>
            <div className="plan-field">
              <label htmlFor="hours">
                <strong>Hours available per week</strong>
              </label>
              <div className="hours-row">
                <input
                  id="hours"
                  type="number"
                  min={1}
                  max={40}
                  step={0.5}
                  value={draft.hours}
                  onChange={(event) => change({ hours: event.target.value as unknown as number })}
                />
                <span className="muted small">hours per week</span>
              </div>
            </div>
            <div className="plan-field">
              <label>
                <strong>When can you study?</strong>
              </label>
              <p className="muted small">
                Tick each session you can realistically keep, for example Mon afternoon or Sat morning.
              </p>
              <div className="slot-grid">
                {DAYS.map((day) => (
                  <div className="slot-day" key={day.id}>
                    <span className="slot-day-label">{day.label}</span>
                    {PERIODS.map((period) => {
                      const id = `${day.id}-${period.id}`;
                      const on = draft.slots.includes(id);
                      return (
                        <label className={`slot ${on ? "on" : ""}`} key={id}>
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={(event) => toggleSlot(id, event.target.checked)}
                          />
                          <span>{period.label}</span>
                        </label>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="actions">
              <button className="primary" id="save-plan" onClick={savePlan}>
                Save my plan
              </button>
              {saved ? (
                <button className="ghost" id="clear-plan" onClick={clearPlan}>
                  Clear saved plan
                </button>
              ) : null}
            </div>
            {notice ? (
              <div className="notice" style={{ marginTop: 14 }}>
                {notice}
              </div>
            ) : null}
          </section>
          {plannerAdjust ? <AdjustPanel draft={draft} onChange={change} /> : null}
        </div>
        <div id="schedule" className="plan-schedule">
          <ScheduleView student={student} draft={draft} />
        </div>
      </div>
    </>
  );
}
