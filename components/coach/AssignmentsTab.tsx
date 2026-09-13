"use client";

import {
  chapterCode,
  cohortName,
  fileFor,
  gradedLessons,
  hasWork,
  shortLessonTitle,
  textFor,
  unansweredQuestion,
  wordCount,
} from "@/lib/course";
import { formatSize, nowLabel } from "@/lib/dates";
import { overallProgress } from "@/lib/metrics";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

interface Props {
  students: Student[];
  onOpenProfile: (id: string) => void;
}

export default function AssignmentsTab({ students, onOpenProfile }: Props) {
  const { data, coach, setCoach, mutate } = useStore();
  const list = gradedLessons(data);
  const lesson = list.find((a) => a.id === coach.assignmentId) || list[0];
  const done = students.filter((s) => hasWork(s, lesson)).length;

  const rows = students.filter((s) => {
    if (coach.filter === "submitted") return hasWork(s, lesson);
    if (coach.filter === "missing") return !hasWork(s, lesson);
    if (coach.filter === "questions") return unansweredQuestion(data, s.id);
    return true;
  });

  const nudge = () => {
    const missing = students.filter((s) => !hasWork(s, lesson) && s.status !== "paused");
    if (!missing.length) return;
    const what = shortLessonTitle(lesson);
    mutate((draft) => {
      missing.forEach((s) => {
        draft.messages[s.id] = draft.messages[s.id] || [];
        draft.messages[s.id].push({
          from: "coach",
          text:
            lesson.type === "upload"
              ? `Reminder: ${what} is due ${lesson.due}. A scan of your working is fine — I would rather see it rough than late.`
              : `Reminder: ${what} is due ${lesson.due}. Send it even if it does not balance, and I will work through it with you.`,
          at: nowLabel(),
          context: `${chapterCode(lesson.chapter)} · ${lesson.type === "upload" ? "Upload" : "Assignment"}`,
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
            {chapterCode(lesson.chapter)} · due {lesson.due} · {done} of {students.length} received
          </p>
        </div>
        <label className="role-chip">
          Assignment
          <select
            id="assignment"
            value={lesson.id}
            onChange={(event) => setCoach({ assignmentId: event.target.value })}
          >
            {list.map((a) => (
              <option key={a.id} value={a.id}>
                {chapterCode(a.chapter)} · {shortLessonTitle(a)}
                {a.type === "upload" ? " (PDF)" : ""}
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
              const ok = hasWork(s, lesson);
              const ask = unansweredQuestion(data, s.id);
              const file = lesson.type === "upload" ? fileFor(s, lesson.id) : null;
              const detail = ok
                ? lesson.type === "upload"
                  ? `${file.name} · ${formatSize(file.size)}`
                  : `${wordCount(textFor(s, lesson.id))} words`
                : "—";
              return (
                <tr key={s.id} onClick={() => onOpenProfile(s.id)}>
                  <td>
                    <strong>{s.name}</strong>
                    <span className="cell-sub">{cohortName(data, s.cohort)}</span>
                  </td>
                  <td>
                    <span className={`badge ${ok ? "ok" : "warn"}`}>
                      {ok ? (lesson.type === "upload" ? "PDF in" : "Submitted") : "Missing"}
                    </span>
                  </td>
                  <td className="muted small">{detail}</td>
                  <td>
                    {ask ? <span className="badge ask">Question</span> : <span className="muted small">—</span>}
                  </td>
                  <td className="muted small">{overallProgress(data, s).pct}%</td>
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
        <button className="primary" id="nudge" onClick={nudge}>
          Nudge everyone missing
        </button>
      </div>
    </section>
  );
}
