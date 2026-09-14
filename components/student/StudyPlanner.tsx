"use client";

import { useEffect, useMemo, useState } from "react";
import AdjustPanel from "@/components/planner/AdjustPanel";
import ScheduleView from "@/components/planner/ScheduleView";
import SubscribeCard from "@/components/planner/SubscribeCard";
import HelpTooltip from "@/components/ui/HelpTooltip";
import { DAYS, DEFAULT_PLAN, PERIODS } from "@/lib/constants";
import { studentFromPlan } from "@/lib/calendar-student";
import { isoDate, longDate, today } from "@/lib/dates";
import { countEvents, feedStamp, feedUrls } from "@/lib/ics";
import { buildIcs } from "@/lib/calendarSync";
import { formatStudyTime } from "@/lib/lesson-duration";
import { planCapacity, planStatus, sortSlots } from "@/lib/planner";
import { courseTasks } from "@/lib/course";
import { clearStudyPlan, fetchStudyPlan, saveStudyPlan } from "@/lib/student-plan";
import { courseDataFromOutline } from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";
import type { CalendarFeed, StudyPlan } from "@/lib/types";

function emptyPlan(): StudyPlan {
  return {
    startDate: isoDate(today()),
    hours: DEFAULT_PLAN.hours,
    slots: [...DEFAULT_PLAN.slots],
    makeups: [],
  };
}

export default function StudyPlanner() {
  const { outline, user, completed } = useStudentSession();
  const course = useMemo(() => courseDataFromOutline(outline), [outline]);
  const [draft, setDraft] = useState<StudyPlan>(emptyPlan);
  const [savedPlan, setSavedPlan] = useState<StudyPlan | null>(null);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [calendar, setCalendar] = useState<CalendarFeed | null>(null);

  const saved = Boolean(savedPlan);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchStudyPlan(user.id).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setStatus(result.error || "Could not load your study plan.");
        setReady(true);
        return;
      }
      if (result.plan) {
        setDraft(result.plan);
        setSavedPlan(result.plan);
        setCalendar({ token: user.id, subscribed: true });
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const doneIds = useMemo(
    () =>
      Object.entries(completed)
        .filter(([, done]) => done)
        .map(([id]) => id),
    [completed]
  );

  const student = useMemo(() => {
    if (!user) return null;
    return {
      ...studentFromPlan(user.id, draft, {
        email: user.email,
        name: user.email || "Student",
        completed: doneIds,
      }),
      calendar: calendar || undefined,
    };
  }, [user, draft, doneIds, calendar]);

  const hoursEntered = Number(draft.hours);
  const hoursReady = Number.isFinite(hoursEntered) && hoursEntered > 0;
  const hours = hoursReady ? hoursEntered : 0;
  const sessionMinutes = planCapacity({ ...draft, hours: hours || 1 });
  const tasks = useMemo(() => courseTasks(course), [course]);
  const courseMinutes = useMemo(() => tasks.reduce((sum, task) => sum + task.minutes, 0), [tasks]);
  const preview = student ? planStatus(course, student, { ...draft, hours: hours || 1 }) : null;
  const previewReady = Boolean(hoursReady && draft.slots.length && preview?.finish);

  const change = (next: Partial<StudyPlan>) => setDraft((current) => ({ ...current, ...next }));
  const toggleSlot = (id: string, on: boolean) => {
    change({ slots: on ? [...draft.slots, id] : draft.slots.filter((slot) => slot !== id) });
  };

  const persist = async (plan: StudyPlan, nextStatus: string) => {
    if (!user || !student) return false;
    setBusy(true);
    setStatus("");
    const result = await saveStudyPlan(user.id, plan);
    if (!result.ok) {
      setBusy(false);
      setStatus(result.error || "Could not save your plan. Run the study_plans SQL in Supabase if this table is new.");
      return false;
    }
    setDraft(plan);
    setSavedPlan(plan);
    setEditing(false);
    await publish(plan, { ...student, plan });
    setBusy(false);
    setStatus(nextStatus);
    return true;
  };

  const publish = async (plan: StudyPlan, owner = student) => {
    if (!user || !owner) return false;
    const token = user.id;
    const ics = buildIcs(course, { ...owner, calendar: { ...(owner.calendar || {}), token }, plan }, plan);
    try {
      const res = await fetch(feedUrls(token).http, {
        method: "PUT",
        headers: { "Content-Type": "text/calendar" },
        body: ics,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setCalendar({ token, subscribed: true, updatedAt: feedStamp(), events: countEvents(ics) });
      return true;
    } catch {
      setCalendar({ token, subscribed: false, failed: true });
      return false;
    }
  };

  const createPlan = async () => {
    if (!draft.slots.length) {
      setStatus("Pick at least one study slot first.");
      return;
    }
    const plan: StudyPlan = {
      startDate: draft.startDate,
      hours: Math.max(0.5, Number(draft.hours) || 1),
      slots: sortSlots(draft.slots),
      makeups: draft.makeups.map((item) => ({ ...item })),
    };
    await persist(plan, "Plan created. Download or subscribe to add it to your calendar.");
  };

  const saveChanges = async () => {
    if (!draft.slots.length) {
      setStatus("Pick at least one study slot first.");
      return;
    }
    const plan: StudyPlan = {
      startDate: draft.startDate,
      hours: Math.max(0.5, Number(draft.hours) || 1),
      slots: sortSlots(draft.slots),
      makeups: draft.makeups.map((item) => ({ ...item })),
    };
    await persist(plan, "Plan updated. Your calendar feed will pick this up on the next refresh.");
  };

  const cancelEdit = () => {
    if (savedPlan) setDraft(savedPlan);
    setEditing(false);
    setStatus("");
  };

  const startOver = async () => {
    if (!user) return;
    if (!window.confirm("Start over? This clears your saved study plan and calendar feed.")) return;
    setBusy(true);
    const result = await clearStudyPlan(user.id);
    if (!result.ok) {
      setBusy(false);
      setStatus(result.error || "Could not clear your plan.");
      return;
    }
    fetch(feedUrls(user.id).http, { method: "DELETE" }).catch(() => {});
    setDraft(emptyPlan());
    setSavedPlan(null);
    setEditing(false);
    setCalendar(null);
    setBusy(false);
    setStatus("");
  };

  const download = () => {
    if (!student) return;
    const ics = buildIcs(course, student, draft);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "iac-skills-study-plan.ics";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    setStatus("Planner downloaded. Import iac-skills-study-plan.ics into Apple Calendar, Google Calendar, or Outlook.");
  };

  const subscribe = async () => {
    if (!student) return;
    const okay = await publish(draft);
    if (okay) {
      const urls = feedUrls(user!.id);
      setStatus("Subscription link is ready. Add it to Apple Calendar, Outlook, or Google Calendar below.");
      window.open(urls.webcal, "_blank", "noopener");
    } else {
      setStatus("Could not publish a live feed. Use Download iCal for a one-off file instead.");
    }
  };

  const stopFeed = () => {
    if (!user) return;
    fetch(feedUrls(user.id).http, { method: "DELETE" }).catch(() => {});
    setCalendar({ token: user.id, subscribed: false });
    setStatus("Feed stopped. Remove the subscription in your calendar app too.");
  };

  if (!user) return null;
  if (!ready) return <p className="student-loading">Loading your study plan…</p>;
  if (!student) return null;

  const showForm = !saved || editing;

  return (
    <section className="student-planner" id="study-planner">
      {saved ? (
        <>
          <p className="kicker">Study planner</p>
          <h1 className="flex items-center gap-2">
            Your study schedule
            <HelpTooltip contentKey="study_planner_header_info" />
          </h1>
          <p className="lead">Your dated sessions are ready. Export them to a calendar, or adjust the plan any time.</p>
          <div className="actions student-planner-export">
            <button className="primary" type="button" onClick={download}>
              Download iCal (.ics)
            </button>
            <button className="ghost" type="button" onClick={subscribe}>
              Subscribe to iCal Link
            </button>
            <button className="ghost" type="button" disabled={busy} onClick={() => setEditing((open) => !open)}>
              {editing ? "Hide setup" : "Adjust Plan"}
            </button>
            <button className="ghost" type="button" disabled={busy} onClick={startOver}>
              Start Over
            </button>
          </div>
          {calendar?.subscribed ? <SubscribeCard student={student} onStop={stopFeed} /> : null}
        </>
      ) : (
        <>
          <p className="kicker">Study planner</p>
          <h1 className="flex items-center gap-2">
            Create your study plan
            <HelpTooltip contentKey="study_planner_header_info" />
          </h1>
          <p className="lead">
            This course has {tasks.length} scheduled lessons totalling {formatStudyTime(courseMinutes)}. Set your start
            date, weekly hours, and study slots to date the rest of the course.
          </p>
        </>
      )}

      {showForm ? (
        <div className="student-planner-form">
          <div
            className={`plan-summary student-plan-preview ${previewReady ? "active" : "empty"}`}
            role="status"
            aria-live="polite"
          >
            {previewReady ? (
              <>
                At {hours} hours a week you finish on <strong>{longDate(preview!.finish!)}</strong>. This plan covers{" "}
                {tasks.length} lessons ({formatStudyTime(courseMinutes)}). Sessions are capped at {sessionMinutes}{" "}
                minutes.
              </>
            ) : (
              <>
                Select your start date, target weekly hours, and study slots below to calculate your estimated
                completion date.
              </>
            )}
          </div>
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
                value={draft.hours || ""}
                onChange={(event) =>
                  change({ hours: event.target.value === "" ? 0 : Number(event.target.value) })
                }
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
          {editing ? <AdjustPanel draft={draft} onChange={change} /> : null}
          <div className="actions">
            {saved ? (
              <>
                <button className="primary" type="button" disabled={busy} onClick={saveChanges}>
                  Save changes
                </button>
                <button className="ghost" type="button" disabled={busy} onClick={cancelEdit}>
                  Cancel
                </button>
              </>
            ) : (
              <button className="primary" type="button" disabled={busy} onClick={createPlan}>
                Create My Plan
              </button>
            )}
          </div>
        </div>
      ) : null}

      {status ? <p className="notice">{status}</p> : null}

      {saved ? <ScheduleView data={course} student={student} draft={draft} /> : null}
    </section>
  );
}
