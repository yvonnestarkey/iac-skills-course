"use client";

import { useEffect, useMemo, useState } from "react";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import {
  deleteCoachReminder,
  dueOnInDays,
  listCoachReminders,
  reminderDueLabel,
  saveCoachReminder,
  type CoachReminder,
} from "@/lib/coach-reminders";
import type { Student } from "@/lib/types";

export default function CoachReminders({
  students,
  onMessage,
}: {
  students: Student[];
  onMessage: (studentIds: string[], label: string) => void;
}) {
  const [reminders, setReminders] = useState<CoachReminder[]>([]);
  const [body, setBody] = useState("");
  const [dueOn, setDueOn] = useState(dueOnInDays(7));
  const [picked, setPicked] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showDone, setShowDone] = useState(false);

  const names = useMemo(() => Object.fromEntries(students.map((student) => [student.id, student.name])), [students]);

  const load = async () => {
    const result = await listCoachReminders();
    setReminders(result.reminders);
    setError(result.error || "");
  };

  useEffect(() => {
    void load();
  }, []);

  const matches = students
    .filter((student) => !picked.includes(student.id))
    .filter((student) => {
      const needle = query.trim().toLowerCase();
      if (!needle) return false;
      return `${student.name} ${student.email}`.toLowerCase().includes(needle);
    })
    .slice(0, 8);

  const visible = reminders.filter((reminder) => showDone || !reminder.done);

  const add = async () => {
    setBusy(true);
    const result = await saveCoachReminder({ body, dueOn: dueOn || null, studentIds: picked });
    setBusy(false);
    if (result.ok === false) {
      setError(result.error);
      return;
    }
    setBody("");
    setDueOn(dueOnInDays(7));
    setPicked([]);
    setQuery("");
    await load();
  };

  const toggleDone = async (reminder: CoachReminder) => {
    setBusy(true);
    const result = await saveCoachReminder({
      id: reminder.id,
      body: reminder.body,
      dueOn: reminder.dueOn,
      done: !reminder.done,
      studentIds: reminder.studentIds,
    });
    setBusy(false);
    if (result.ok === false) setError(result.error);
    else await load();
  };

  const remove = async (reminder: CoachReminder) => {
    setBusy(true);
    const result = await deleteCoachReminder(reminder.id);
    setBusy(false);
    if (result.ok === false) setError(result.error);
    else await load();
  };

  return (
    <section className="card coach-dash-reminders">
      <div className="coach-dash-queue-head">
        <div>
          <p className="kicker">Just for you</p>
          <h2>Reminders</h2>
        </div>
        <button type="button" className="ghost" onClick={() => setShowDone((current) => !current)}>
          {showDone ? "Hide done" : "Show done"}
        </button>
      </div>
      <p className="muted small">
        A private to-do list. Link students when you want to check in with them later.
      </p>
      {error ? <p className="waiting">{error}</p> : null}

      <label className="student-notes-label" htmlFor="coach-reminder-body">
        Reminder
      </label>
      <textarea
        id="coach-reminder-body"
        rows={2}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Follow up on Task 2 progress"
        disabled={busy}
      />
      <div className="coach-reminder-meta">
        <label className="student-notes-label" htmlFor="coach-reminder-due">
          Remind me on
        </label>
        <input id="coach-reminder-due" type="date" value={dueOn} onChange={(event) => setDueOn(event.target.value)} disabled={busy} />
        <button type="button" className="ghost" disabled={busy} onClick={() => setDueOn(dueOnInDays(7))}>
          In a week
        </button>
      </div>
      <label className="student-notes-label" htmlFor="coach-reminder-students">
        Students (optional)
      </label>
      {picked.length ? (
        <p className="coach-reminder-chips">
          {picked.map((id) => (
            <button key={id} type="button" className="coach-reminder-chip" onClick={() => setPicked((current) => current.filter((item) => item !== id))}>
              {names[id] || "Student"} ×
            </button>
          ))}
        </p>
      ) : null}
      <input
        id="coach-reminder-students"
        className="select-line"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Type a student name"
        disabled={busy}
      />
      {matches.length ? (
        <div className="coach-reminder-matches">
          {matches.map((student) => (
            <button
              key={student.id}
              type="button"
              onClick={() => {
                setPicked((current) => [...current, student.id]);
                setQuery("");
              }}
            >
              {student.name}
              <span className="muted small">{student.email}</span>
            </button>
          ))}
        </div>
      ) : null}
      <p className="coaching-actions">
        <button type="button" className="primary" disabled={busy || !body.trim()} onClick={() => void add()}>
          {busy ? "Saving…" : "Add reminder"}
        </button>
      </p>

      {visible.length ? (
        <ul className="coach-reminder-list">
          {visible.map((reminder) => {
            const due = reminderDueLabel(reminder);
            const people = reminder.studentIds.map((id) => names[id] || "Student");
            return (
              <li key={reminder.id} className={`coach-reminder-item${reminder.done ? " is-done" : ""}${due === "overdue" || due === "today" ? " is-due" : ""}`}>
                <label>
                  <input type="checkbox" checked={reminder.done} disabled={busy} onChange={() => void toggleDone(reminder)} />
                  <span>
                    <strong>{reminder.body}</strong>
                    {reminder.dueOn ? (
                      <em>
                        {due === "overdue" ? "Overdue · " : due === "today" ? "Due today · " : "Due "}
                        {reminder.dueOn}
                      </em>
                    ) : null}
                    {people.length ? (
                      <span className="coach-reminder-people">
                        {reminder.studentIds.map((id) => (
                          <StudentProfileLink key={id} studentId={id}>
                            {names[id] || "Student"}
                          </StudentProfileLink>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </label>
                <span className="coach-reminder-item-actions">
                  {reminder.studentIds.length ? (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => onMessage(reminder.studentIds, people.length === 1 ? people[0] : `${people.length} students on this reminder`)}
                    >
                      Message
                    </button>
                  ) : null}
                  <button type="button" className="ghost" disabled={busy} onClick={() => void remove(reminder)}>
                    Remove
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">No reminders yet.</p>
      )}
    </section>
  );
}
