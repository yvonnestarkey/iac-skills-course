"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { postInboxMessage } from "@/lib/inbox";
import { fetchRosterStudent } from "@/lib/profiles";
import type { Student } from "@/lib/types";
import AuditThread from "@/components/comms/AuditThread";
import { commsForStudent } from "@/lib/comms";
import { SURVEY_QUESTIONS } from "@/lib/constants";
import {
  chapterCode,
  cohortName,
  fileFor,
  gradedLessons,
  initials,
  lastActiveLabel,
  shortLessonTitle,
  surveyFor,
  surveyLessons,
  surveyScore,
  textFor,
  thread,
  unansweredQuestion,
} from "@/lib/course";
import { formatSize, longDate, nowLabel, parseISO, today } from "@/lib/dates";
import { overallProgress, submittedCount } from "@/lib/metrics";
import { planCapacity, planStatus, slotLabel } from "@/lib/planner";
import { fileHref, useStore } from "@/lib/store";

export default function StudentProfile({ studentId }: { studentId: string }) {
  const { data, mutate, setNotifyDraft, notice } = useStore();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const seeded = data.students.find((s) => s.id === studentId) || null;
  const [live, setLive] = useState<Student | null>(null);
  const [loadingLive, setLoadingLive] = useState(!seeded);

  useEffect(() => {
    if (seeded) return;
    fetchRosterStudent(studentId).then((found) => {
      setLive(found);
      setLoadingLive(false);
    });
  }, [studentId, seeded]);

  const student = seeded || live;
  if (loadingLive) {
    return (
      <div className="coach-page">
        <button className="back-link" onClick={() => router.push("/coach/lists")}>
          ← Back to dashboard
        </button>
        <p className="empty">Loading student…</p>
      </div>
    );
  }
  if (!student) {
    return (
      <div className="coach-page">
        <button className="back-link" onClick={() => router.push("/coach/lists")}>
          ← Back to dashboard
        </button>
        <p className="empty">No such student.</p>
      </div>
    );
  }

  const p = overallProgress(data, student);
  const status = student.plan ? planStatus(data, student) : null;
  const pending = unansweredQuestion(data, student.id);
  const graded = gradedLessons(data);
  const surveys = surveyLessons(data);
  const messages = thread(data, student.id);

  const saveNote = () => {
    const text = note.trim();
    if (!text || !seeded) return;
    mutate((draft) => {
      const target = draft.students.find((s) => s.id === student.id);
      if (!target) return;
      target.notes = target.notes || [];
      target.notes.unshift({ text, at: longDate(today()) });
    });
    setNote("");
  };

  const dropNote = (index: number) => {
    if (!seeded) return;
    mutate((draft) => {
      const target = draft.students.find((s) => s.id === student.id);
      if (!target) return;
      target.notes.splice(index, 1);
    });
  };

  const sendMessage = async () => {
    const text = message.trim();
    if (!text) return;
    if (!seeded) {
      await postInboxMessage({
        studentId: student.id,
        studentEmail: student.email,
        from: "coach",
        kind: "reply",
        body: text,
        context: "Coach reply",
      });
      setMessage("");
      return;
    }
    mutate((draft) => {
      draft.messages[student.id] = draft.messages[student.id] || [];
      draft.messages[student.id].push({ from: "coach", text, at: nowLabel() });
    });
    setMessage("");
  };

  return (
    <div className="coach-page">
      <button className="back-link" id="back-dash" onClick={() => router.push("/coach/lists")}>
        ← Back to dashboard
      </button>
      <div className="profile-head">
        <div className="avatar">{initials(student.name)}</div>
        <div className="profile-id">
          <h1>{student.name}</h1>
          <p className="muted">
            {student.email} · {cohortName(data, student.cohort)} · joined {student.joined || "—"}
          </p>
        </div>
        <div className="profile-tags">
          <span className={`badge ${student.status === "paused" ? "warn" : "ok"}`}>
            {student.status === "paused" ? "Paused" : "Active"}
          </span>
          <span className="muted small">Last active {lastActiveLabel(student)}</span>
          <button
            className="primary"
            onClick={() =>
              setNotifyDraft({
                audience: "student",
                audienceLabel: student.name,
                recipientIds: [student.id],
              })
            }
          >
            Send notification
          </button>
        </div>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}

      <section className="card">
        <div className="panel-head">
          <div>
            <h2>Progress</h2>
            <p className="muted small">
              {p.done} of {p.total} course items complete
            </p>
          </div>
          <span className="score-chip">{p.pct}%</span>
        </div>
        <div className="progress-wide">
          <span style={{ width: `${p.pct}%` }} />
        </div>
        <div className="progress-legend">
          <span>
            {submittedCount(data, student)} of {graded.length} submissions in
          </span>
          <span>
            {surveys.filter((l) => surveyFor(student, l.id)).length} of {surveys.length} surveys
          </span>
          <span>{messages.filter((m) => m.kind === "question").length} questions asked</span>
        </div>
      </section>

      <div className="profile-grid">
        <section className="card">
          <h2>Study planner settings</h2>
          {student.plan ? (
            <dl className="fact-list">
              <div>
                <dt>Start date</dt>
                <dd>{longDate(parseISO(student.plan.startDate))}</dd>
              </div>
              <div>
                <dt>Hours per week</dt>
                <dd>{student.plan.hours}</dd>
              </div>
              <div>
                <dt>Sessions</dt>
                <dd>{student.plan.slots.map((s) => slotLabel(s)).join(", ")}</dd>
              </div>
              <div>
                <dt>Session length</dt>
                <dd>{planCapacity(student.plan)} min</dd>
              </div>
              <div>
                <dt>Make-up sessions</dt>
                <dd>
                  {(student.plan.makeups || []).length
                    ? student.plan.makeups
                        .map((m) => `${longDate(parseISO(m.date))} (${m.minutes} min)`)
                        .join(", ")
                    : "none"}
                </dd>
              </div>
              <div>
                <dt>Projected finish</dt>
                <dd>{status && status.finish ? longDate(status.finish) : "course complete"}</dd>
              </div>
              <div>
                <dt>Behind by</dt>
                <dd>
                  {status && status.overdue.length
                    ? `${status.overdue.length} item${status.overdue.length === 1 ? "" : "s"}`
                    : "on track"}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="empty">No study plan created yet.</p>
          )}
        </section>
        <section className="card notes-card">
          <h2>Coach notes</h2>
          <p className="muted small">Private to you — students never see these.</p>
          <textarea
            id="note-text"
            rows={4}
            placeholder={`Add a private note about ${student.name.split(" ")[0]}…`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          <div className="actions">
            <button className="primary" id="save-note" onClick={saveNote}>
              Save note
            </button>
          </div>
          {(student.notes || []).length ? (
            <ul className="note-list">
              {student.notes.map((n, i) => (
                <li key={`${n.at}-${i}`}>
                  <p>{n.text}</p>
                  <div className="note-foot">
                    <span className="muted small">{n.at}</span>
                    <button className="link-btn" onClick={() => dropNote(i)}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="empty">No notes yet.</p>
          )}
        </section>
      </div>

      <section className="card">
        <h2>Assignment submissions</h2>
        <div className="work-list">
          {graded.map((lesson) => {
            const text = textFor(student, lesson.id);
            const file = fileFor(student, lesson.id);
            const href = file ? fileHref(student.id, lesson.id, file) : "";
            return (
              <div className="work-item" key={lesson.id}>
                <div className="work-head">
                  <strong>{shortLessonTitle(lesson)}</strong>
                  <span className="muted small">
                    {chapterCode(lesson.chapter)} · due {lesson.due}
                  </span>
                </div>
                {lesson.type === "upload" ? (
                  file ? (
                    <div className="file-card compact">
                      <span className="file-icon">PDF</span>
                      <div className="file-meta">
                        <strong>{file.name}</strong>
                        <span className="muted small">
                          {formatSize(file.size)} · uploaded {file.at}
                        </span>
                      </div>
                      {href ? (
                        <a className="primary" href={href} target="_blank" rel="noopener">
                          Open PDF
                        </a>
                      ) : (
                        <span className="muted small">Uploaded in an earlier session</span>
                      )}
                    </div>
                  ) : (
                    <div className="submission empty">No PDF uploaded.</div>
                  )
                ) : (
                  <div className={`submission ${text.trim() ? "" : "empty"}`}>
                    {text.trim() ? text : "Nothing submitted."}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Module survey responses</h2>
        <div className="work-list">
          {surveys.map((lesson) => {
            const answer = surveyFor(student, lesson.id);
            if (!answer) {
              return (
                <div className="work-item" key={lesson.id}>
                  <div className="work-head">
                    <strong>{lesson.title}</strong>
                    <span className="muted small">no response</span>
                  </div>
                </div>
              );
            }
            return (
              <div className="work-item" key={lesson.id}>
                <div className="work-head">
                  <strong>{lesson.title}</strong>
                  <span className="score-chip small">{surveyScore(answer).toFixed(1)} / 5</span>
                </div>
                {SURVEY_QUESTIONS.map((q) => (
                  <div className="score-row" key={q.id}>
                    <span>{q.label}</span>
                    <b>{answer[q.id] || "—"} / 5</b>
                  </div>
                ))}
                {answer.comment ? <p className="survey-comment">“{answer.comment}”</p> : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="panel-head">
          <div>
            <h2>Notifications</h2>
            <p className="muted small">Announcements sent to {student.name.split(" ")[0]}, and their replies.</p>
          </div>
          <button
            className="ghost"
            onClick={() =>
              setNotifyDraft({
                audience: "student",
                audienceLabel: student.name,
                recipientIds: [student.id],
              })
            }
          >
            Send notification
          </button>
        </div>
        <div className="work-list">
          {commsForStudent(data, student.id).length ? (
            commsForStudent(data, student.id).map((comm) => (
              <AuditThread key={comm.id} comm={comm} readerId="coach" readerRole="coach" />
            ))
          ) : (
            <p className="empty">No notifications to this student yet.</p>
          )}
        </div>
      </section>

      <section className="card">
        <h2>Ask the Coach</h2>
        {pending ? <div className="waiting">Waiting on you: {pending.text}</div> : null}
        <div className="thread">
          {messages.length ? (
            messages.map((m, i) => (
              <div className={`bubble ${m.from} ${m.kind === "question" ? "question" : ""}`} key={i}>
                {m.text}
                <div className="muted small">
                  {m.at} · {m.kind === "question" ? "Asked the coach" : m.from === "coach" ? "You" : student.name}
                </div>
              </div>
            ))
          ) : (
            <p className="empty">No questions or messages yet.</p>
          )}
        </div>
        <div className="compose">
          <input
            id="coach-msg"
            type="text"
            placeholder={pending ? "Answer this question…" : `Feedback for ${student.name.split(" ")[0]}…`}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendMessage();
            }}
          />
          <button className="primary" id="send-coach" onClick={sendMessage}>
            {pending ? "Reply" : "Send"}
          </button>
        </div>
      </section>
    </div>
  );
}
