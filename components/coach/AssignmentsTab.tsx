"use client";

import { useState } from "react";
import { labelForGroup } from "@/lib/comms";
import {
  chapterCode,
  cohortName,
  fileFor,
  hasWork,
  shortLessonTitle,
  textFor,
  unansweredQuestion,
  wordCount,
} from "@/lib/course";
import { formatSize, nowLabel } from "@/lib/dates";
import { completionProgress } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { FlatLesson, Student } from "@/lib/types";

interface Props {
  students: Student[];
  lessons: FlatLesson[];
  lessonIds: string[];
  surveyPairs: Record<string, string[]>;
  onOpenProfile: (id: string) => void;
}

function studentHasLiveWork(
  student: Student,
  lesson: FlatLesson,
  surveyPairs: Record<string, string[]>
): boolean {
  if (lesson.type === "survey") {
    const surveyId = lesson.survey_id || "";
    if (surveyId && (surveyPairs[student.id] || []).includes(surveyId)) return true;
    return Boolean((student.completed || []).includes(lesson.id) || textFor(student, lesson.id).trim());
  }
  return hasWork(student, lesson);
}

export default function AssignmentsTab({ students, lessons, lessonIds, surveyPairs, onOpenProfile }: Props) {
  const { data, coach, setCoach, mutate, setNotifyDraft } = useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const list = lessons;
  const lesson = list.find((item) => item.id === coach.assignmentId) || list[0];

  if (!lesson) {
    return (
      <section className="card">
        <div className="panel-head">
          <div>
            <h2>Assignments</h2>
            <p className="muted small">Live assignment and survey lessons from the course.</p>
          </div>
        </div>
        <p className="empty">No assignment or survey lessons in the live course yet.</p>
      </section>
    );
  }

  const done = students.filter((student) => studentHasLiveWork(student, lesson, surveyPairs)).length;

  const rows = students.filter((student) => {
    if (coach.filter === "submitted") return studentHasLiveWork(student, lesson, surveyPairs);
    if (coach.filter === "missing") return !studentHasLiveWork(student, lesson, surveyPairs);
    if (coach.filter === "questions") return unansweredQuestion(data, student.id);
    return true;
  });

  const toggle = (id: string) => {
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  };

  const filterLabel =
    coach.filter === "missing"
      ? "Missing this assignment"
      : coach.filter === "submitted"
        ? "Submitted this assignment"
        : coach.filter === "questions"
          ? "Waiting on a reply"
          : shortLessonTitle(lesson);

  const notifyFiltered = () => {
    if (!rows.length) return;
    setNotifyDraft({
      audience: "filtered",
      audienceLabel: labelForGroup(data, rows, "filtered", filterLabel),
      recipientIds: rows.map((s) => s.id),
    });
  };

  const notifySelected = () => {
    const picked = rows.filter((s) => selected.includes(s.id));
    if (!picked.length) return;
    setNotifyDraft({
      audience: "selected",
      audienceLabel: labelForGroup(data, picked, "selected"),
      recipientIds: picked.map((s) => s.id),
    });
  };

  const nudge = () => {
    const missing = students.filter((s) => !studentHasLiveWork(s, lesson, surveyPairs) && s.status !== "paused");
    if (!missing.length) return;
    const what = shortLessonTitle(lesson);
    mutate((draft) => {
      missing.forEach((s) => {
        draft.messages[s.id] = draft.messages[s.id] || [];
        draft.messages[s.id].push({
          from: "coach",
          text:
            lesson.type === "survey"
              ? `Reminder: ${what} is still open. A short check-in is enough — I would rather see it honest than late.`
              : `Reminder: ${what} is due ${lesson.due || "soon"}. Send it even if it does not balance, and I will work through it with you.`,
          at: nowLabel(),
          context: `${chapterCode(lesson.chapter)} · ${lesson.type === "survey" ? "Survey" : "Assignment"}`,
        });
      });
    });
  };

  return (
    <section className="card">
      <div className="panel-head">
        <div>
          <h2>{shortLessonTitle(lesson)}</h2>
          <p className="muted small">
            {chapterCode(lesson.chapter)}
            {lesson.due ? ` · due ${lesson.due}` : ""} · {done} of {students.length} received
          </p>
        </div>
        <label className="role-chip">
          Assignment
          <select
            id="assignment"
            value={lesson.id}
            onChange={(event) => setCoach({ assignmentId: event.target.value })}
          >
            {list.map((item) => (
              <option key={item.id} value={item.id}>
                {chapterCode(item.chapter)} · {shortLessonTitle(item)}
                {item.type === "survey" ? " (survey)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="filters">
        {(["all", "missing", "questions", "submitted"] as const).map((id) => (
          <button
            key={id}
            className={coach.filter === id ? "active" : ""}
            onClick={() => setCoach({ filter: id })}
          >
            {id === "all" ? "All" : id === "missing" ? "Missing" : id === "questions" ? "Questions" : "Received"}
          </button>
        ))}
      </div>
      {rows.length ? (
        <table className="data-table">
          <thead>
            <tr>
              <th className="check-col">
                <input
                  type="checkbox"
                  checked={Boolean(rows.length && rows.every((s) => selected.includes(s.id)))}
                  onChange={() =>
                    setSelected((current) =>
                      rows.every((s) => current.includes(s.id))
                        ? current.filter((id) => !rows.some((s) => s.id === id))
                        : [...new Set([...current, ...rows.map((s) => s.id)])]
                    )
                  }
                  aria-label="Select all visible students"
                />
              </th>
              <th>Student</th>
              <th>Status</th>
              <th>Submission</th>
              <th>Waiting</th>
              <th>Course</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const ok = studentHasLiveWork(s, lesson, surveyPairs);
              const ask = unansweredQuestion(data, s.id);
              const file = lesson.type === "upload" ? fileFor(s, lesson.id) : null;
              const detail = ok
                ? lesson.type === "survey"
                  ? "Survey in"
                  : lesson.type === "upload" && file
                    ? `${file.name} · ${formatSize(file.size)}`
                    : `${wordCount(textFor(s, lesson.id))} words`
                : "—";
              return (
                <tr key={s.id} onClick={() => onOpenProfile(s.id)}>
                  <td className="check-col" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.includes(s.id)}
                      onChange={() => toggle(s.id)}
                      aria-label={`Select ${s.name}`}
                    />
                  </td>
                  <td>
                    <strong>{s.name}</strong>
                    <span className="cell-sub">{cohortName(data, s.cohort)}</span>
                  </td>
                  <td>
                    <span className={`badge ${ok ? "ok" : "warn"}`}>
                      {ok ? (lesson.type === "survey" ? "Survey in" : "Submitted") : "Missing"}
                    </span>
                  </td>
                  <td className="muted small">{detail}</td>
                  <td>
                    {ask ? <span className="badge ask">Question</span> : <span className="muted small">—</span>}
                  </td>
                  <td className="muted small">{completionProgress(s.completed, lessonIds).pct}%</td>
                  <td className="row-go">Open profile →</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="empty">No students in this filter.</p>
      )}
      <div className="actions">
        <button className="primary" onClick={notifyFiltered} disabled={!rows.length}>
          Notify this group ({rows.length})
        </button>
        <button className="ghost" onClick={notifySelected} disabled={!selected.filter((id) => rows.some((s) => s.id === id)).length}>
          Notify selected ({selected.filter((id) => rows.some((s) => s.id === id)).length})
        </button>
        <button className="ghost" id="nudge" onClick={nudge}>
          Nudge everyone missing
        </button>
      </div>
    </section>
  );
}
