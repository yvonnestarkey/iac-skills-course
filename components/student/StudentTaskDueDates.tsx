"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { longDate, parseISO } from "@/lib/dates";
import {
  fetchStudentRegisteredOn,
  fetchStudentTaskDueDates,
  isTaskSubmitted,
  portalToday,
  saveStudentTaskDueDate,
  saveStudentTaskDueDates,
  suggestedTaskDueDates,
  taskDateToShow,
  taskDueItemsFromOutline,
  type TaskDueDateHistoryRow,
  type TaskDueItem,
} from "@/lib/student-task-due-dates";
import { useStudentSession } from "@/lib/student-session";
import { useCoursePreview } from "@/lib/course-preview";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

type TaskRow = TaskDueItem & { completed: boolean };

function formatDue(value: string | null | undefined): string {
  if (!value) return "cleared";
  return longDate(parseISO(value));
}

function taskLabel(item: TaskDueItem): string {
  return `${item.label} (${item.approx})`;
}

export default function StudentTaskDueDates() {
  const { ready, user, submissions } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { basePath } = useCoursePreview();
  const items = useMemo(
    () =>
      taskDueItemsFromOutline(outline).map((item) => ({
        ...item,
        completed: isTaskSubmitted(item, submissions),
      })),
    [outline, submissions]
  );
  const completed = items.filter((item) => item.completed);
  const next = items.find((item) => !item.completed) || null;
  const later = items.filter((item) => !item.completed && item.id !== next?.id);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<TaskDueDateHistoryRow[]>([]);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = useCallback(
    async (studentId: string) => {
      const [result, registeredOn] = await Promise.all([
        fetchStudentTaskDueDates(studentId),
        fetchStudentRegisteredOn(studentId),
      ]);
      if (!result.ok) {
        setStatus(
          result.error || "Could not load your Task dates. Run the student-task-due-dates SQL in Supabase if this table is new."
        );
      }
      const saved: Record<string, string> = {};
      Object.values(result.dates || {}).forEach((row) => {
        if (row.dueOn) saved[row.taskId] = row.dueOn;
      });
      const suggested = suggestedTaskDueDates({
        today: portalToday(),
        registeredOn: registeredOn || portalToday(),
        items,
      });
      const missing = items
        .filter((item) => !saved[item.id] && suggested[item.id])
        .map((item) => ({ taskId: item.id, dueOn: suggested[item.id] }));
      if (result.ok && missing.length) {
        const savedAuto = await saveStudentTaskDueDates(studentId, missing);
        if (!savedAuto.ok) {
          setStatus(savedAuto.error || "Could not save the suggested Task dates.");
        }
      }
      setDates({ ...suggested, ...saved });
      setHistory(result.history || []);
      if (result.ok) setStatus("");
    },
    [items]
  );

  useEffect(() => {
    if (!user?.id || !ready) return;
    void load(user.id);
  }, [user?.id, ready, load]);

  const save = async (taskId: string, dueOn: string) => {
    if (!user?.id) return;
    const value = dueOn.trim() || null;
    setDates((current) => {
      const nextDates = { ...current };
      if (value) nextDates[taskId] = value;
      else delete nextDates[taskId];
      return nextDates;
    });
    setBusyId(taskId);
    const result = await saveStudentTaskDueDate(user.id, taskId, value);
    setBusyId("");
    if (!result.ok) {
      setStatus(result.error || "Could not save that date.");
      return;
    }
    setStatus("Saved.");
    await load(user.id);
  };

  const hrefFor = (item: TaskRow) => (item.firstLessonId ? `${basePath}/${item.firstLessonId}` : null);

  const historyFor = (taskId: string) => {
    const rows = history.filter((row) => row.taskId === taskId);
    const previous = rows.filter((row) => row.previousDueOn != null || rows.length > 1);
    return { rows, previous };
  };

  const renderTaskList = (rows: TaskRow[], extra?: ReactNode) => {
    if (!rows.length && !extra) return null;
    return (
      <ul className="student-task-date-list">
        {rows.map((item) => {
          const href = hrefFor(item);
          const dueOn = dates[item.id] || "";
          const shown = taskDateToShow(item, submissions, dueOn);
          const { rows: historyRows, previous } = historyFor(item.id);
          return (
            <li key={item.id} className={item.completed ? "is-complete" : undefined}>
              <div className="student-task-date-row">
                <span className="student-task-date-label">
                  {href ? <Link href={href}>{taskLabel(item)}</Link> : taskLabel(item)}
                  {item.completed ? (
                    <span className="task-complete-mark">
                      <span className="task-complete-tick" aria-hidden="true">
                        ✓
                      </span>
                      <span className="task-complete-stamp">completed!</span>
                    </span>
                  ) : null}
                </span>
                {shown.kind === "submitted" ? (
                  <span className="student-task-date-value is-submitted">
                    <span className="student-task-date-kind">Submitted</span>
                    {shown.date ? longDate(parseISO(shown.date)) : "—"}
                  </span>
                ) : editing ? (
                  <input
                    id={`task-due-${item.id}`}
                    type="date"
                    className="select-line"
                    value={dueOn}
                    disabled={busyId === item.id}
                    aria-label={`${item.label} due date`}
                    onChange={(event) => void save(item.id, event.target.value)}
                  />
                ) : (
                  <span className="student-task-date-value">{shown.date ? longDate(parseISO(shown.date)) : "—"}</span>
                )}
              </div>
              {editing && previous.length ? (
                <div className="student-task-date-history">
                  <button
                    type="button"
                    onClick={() => setOpenHistory((current) => (current === item.id ? null : item.id))}
                  >
                    {openHistory === item.id ? "Hide previous dates" : `${previous.length} previous date${previous.length === 1 ? "" : "s"}`}
                  </button>
                  {openHistory === item.id ? (
                    <ol>
                      {historyRows.map((row) => (
                        <li key={row.id}>
                          {formatDue(row.dueOn)}
                          {row.previousDueOn ? ` · was ${formatDue(row.previousDueOn)}` : " · first set"}
                          {row.changedAt ? ` · ${new Date(row.changedAt).toLocaleString()}` : ""}
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ) : null}
            </li>
          );
        })}
        {extra}
      </ul>
    );
  };

  if (!user) return null;

  return (
    <section className="student-task-dates">
      <div className="student-task-dates-art">
        <div className="student-task-dates-top">
          <div>
            <p className="kicker">Tasks</p>
            <h2>Your Task dates</h2>
          </div>
          <button type="button" onClick={() => setEditing((current) => !current)}>
            {editing ? "Done" : "Edit"}
          </button>
        </div>

        {renderTaskList(completed)}

        <div className="student-task-dates-featured">
          {next ? (
            <>
              <p className="student-event-countdown">
                {dates[next.id] ? `Due ${longDate(parseISO(dates[next.id]))}` : "Set a due date"}
              </p>
              <p className="student-upcoming-featured-when">{next.approx}</p>
              <strong>{next.label}</strong>
              {editing ? (
                <input
                  type="date"
                  className="select-line"
                  value={dates[next.id] || ""}
                  disabled={busyId === next.id}
                  aria-label={`${next.label} due date`}
                  onChange={(event) => void save(next.id, event.target.value)}
                />
              ) : hrefFor(next) ? (
                <Link className="primary" href={hrefFor(next)!}>
                  Open Task
                </Link>
              ) : null}
            </>
          ) : (
            <>
              <p className="student-event-countdown">All Tasks complete</p>
              <span className="task-complete-mark">
                <span className="task-complete-tick" aria-hidden="true">
                  ✓
                </span>
                <span className="task-complete-stamp">completed!</span>
              </span>
            </>
          )}
        </div>

        {renderTaskList(
          later,
          status ? (
            <li>
              <p className="muted small">{status}</p>
            </li>
          ) : null
        )}
      </div>
    </section>
  );
}
