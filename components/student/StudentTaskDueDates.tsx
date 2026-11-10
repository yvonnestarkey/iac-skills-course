"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { longDate, parseISO } from "@/lib/dates";
import {
  fetchStudentTaskDueDates,
  saveStudentTaskDueDate,
  taskDueItemsFromOutline,
  type TaskDueDateHistoryRow,
} from "@/lib/student-task-due-dates";
import { useStudentSession } from "@/lib/student-session";
import { useCoursePreview } from "@/lib/course-preview";
import { useVisibleCourseOutline } from "@/lib/visible-course-outline";

function formatDue(value: string | null | undefined): string {
  if (!value) return "cleared";
  return longDate(parseISO(value));
}

export default function StudentTaskDueDates() {
  const { user } = useStudentSession();
  const outline = useVisibleCourseOutline();
  const { basePath } = useCoursePreview();
  const items = useMemo(() => taskDueItemsFromOutline(outline), [outline]);
  const [dates, setDates] = useState<Record<string, string>>({});
  const [history, setHistory] = useState<TaskDueDateHistoryRow[]>([]);
  const [openHistory, setOpenHistory] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState("");

  const load = async (studentId: string) => {
    const result = await fetchStudentTaskDueDates(studentId);
    if (!result.ok) {
      setStatus(result.error || "Could not load your Task dates. Run the student-task-due-dates SQL in Supabase if this table is new.");
      return;
    }
    const next: Record<string, string> = {};
    Object.values(result.dates).forEach((row) => {
      if (row.dueOn) next[row.taskId] = row.dueOn;
    });
    setDates(next);
    setHistory(result.history);
    setStatus("");
  };

  useEffect(() => {
    if (!user?.id) return;
    void load(user.id);
  }, [user?.id]);

  const save = async (taskId: string, dueOn: string) => {
    if (!user?.id) return;
    const value = dueOn.trim() || null;
    setDates((current) => {
      const next = { ...current };
      if (value) next[taskId] = value;
      else delete next[taskId];
      return next;
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

  if (!user) return null;

  return (
    <section className="student-task-dates">
      <h2>Your Task dates</h2>
      <p className="muted small">
        Set the date you plan to complete each Task. You can change these whenever you need to — every change is kept.
      </p>
      <ul className="student-task-date-list">
        {items.map((item) => {
          const href = item.firstLessonId ? `${basePath}/${item.firstLessonId}` : null;
          const rows = history.filter((row) => row.taskId === item.id);
          const previous = rows.filter((row) => row.previousDueOn != null || rows.length > 1);
          return (
            <li key={item.id}>
              <label className="student-task-date-row" htmlFor={`task-due-${item.id}`}>
                <span>
                  {href ? (
                    <Link href={href}>
                      {item.label} ({item.approx})
                    </Link>
                  ) : (
                    <>
                      {item.label} ({item.approx})
                    </>
                  )}
                  :
                </span>
                <input
                  id={`task-due-${item.id}`}
                  type="date"
                  className="select-line"
                  value={dates[item.id] || ""}
                  disabled={busyId === item.id}
                  onChange={(event) => void save(item.id, event.target.value)}
                />
              </label>
              {previous.length ? (
                <div className="student-task-date-history">
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => setOpenHistory((current) => (current === item.id ? null : item.id))}
                  >
                    {openHistory === item.id ? "Hide previous dates" : `${previous.length} previous date${previous.length === 1 ? "" : "s"}`}
                  </button>
                  {openHistory === item.id ? (
                    <ol>
                      {rows.map((row) => (
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
      </ul>
      {status ? <p className="muted small">{status}</p> : null}
    </section>
  );
}
