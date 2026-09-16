"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AskCoachThread from "@/components/coach/AskCoachThread";
import BmcrEvaluationsPanel from "@/components/coach/BmcrEvaluationsPanel";
import { fetchLiveLessonIds, fetchRosterStudent } from "@/lib/profiles";
import type { Student } from "@/lib/types";
import AuditThread from "@/components/comms/AuditThread";
import { commsForStudent } from "@/lib/comms";
import { cohortName, initials, lastActiveLabel } from "@/lib/course";
import {
  fetchStudentSurveyPacks,
  formatSurveyAnswer,
  isBmcrBlock,
  isInfoBlock,
  questionCollectsAnswer,
} from "@/lib/custom-surveys";
import { formatSastDateTime, longDate, parseISO, today } from "@/lib/dates";
import { completionProgress } from "@/lib/metrics";
import { planCapacity, planStatus, slotLabel } from "@/lib/planner";
import { fetchCourseOutline } from "@/lib/student-lesson";
import { fetchStudentSubmissions, type StudentSubmission } from "@/lib/student-submissions";
import { useStore } from "@/lib/store";

export default function StudentProfile({ studentId }: { studentId: string }) {
  const { data, setNotifyDraft, notice } = useStore();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [live, setLive] = useState<Student | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});
  const [surveyPacks, setSurveyPacks] = useState<{ title: string; answers: { label: string; value: string }[] }[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingLive(true);
    Promise.all([
      fetchRosterStudent(studentId),
      fetchLiveLessonIds(),
      fetchStudentSubmissions(studentId),
      fetchCourseOutline(),
      fetchStudentSurveyPacks(studentId),
    ]).then(([found, ids, submitted, outline, packs]) => {
      if (cancelled) return;
      setLive(found);
      setLessonIds(ids);
      setSubmissions(Object.values(submitted));
      const titles: Record<string, string> = {};
      outline.forEach((chapter) => {
        chapter.lessons.forEach((lesson) => {
          titles[lesson.id] = lesson.title;
        });
      });
      setLessonTitles(titles);
      setSurveyPacks(
        packs.map((pack) => ({
          title: pack.survey.title,
          answers: pack.survey.questions
            .filter((question) => questionCollectsAnswer(question.type) && !isInfoBlock(question.type) && !isBmcrBlock(question.type))
            .map((question) => ({
              label: question.label,
              value: formatSurveyAnswer(pack.response.answers[question.id], question.type),
            }))
            .filter((item) => item.value),
        }))
      );
      setLoadingLive(false);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  const student = live;
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

  const p = completionProgress(student.completed, lessonIds);
  const status = student.plan ? planStatus(data, student) : null;

  const saveNote = () => {
    const text = note.trim();
    if (!text || !live) return;
    setLive({
      ...live,
      notes: [{ text, at: longDate(today()) }, ...(live.notes || [])],
    });
    setNote("");
  };

  const dropNote = (index: number) => {
    if (!live) return;
    setLive({
      ...live,
      notes: (live.notes || []).filter((_, current) => current !== index),
    });
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
            {p.done} of {p.total} lessons complete
          </span>
          <span>
            {submissions.length} assignment submission{submissions.length === 1 ? "" : "s"}
          </span>
          <span>
            {surveyPacks.length} survey response{surveyPacks.length === 1 ? "" : "s"}
          </span>
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
        {submissions.length ? (
          <div className="work-list">
            {submissions.map((item) => (
              <div className="work-item" key={item.id || `${item.student_id}-${item.lesson_id}`}>
                <div className="work-head">
                  <strong>{lessonTitles[item.lesson_id] || item.lesson_id}</strong>
                  <span className="muted small">{item.status}{item.updated_at ? ` · ${formatSastDateTime(item.updated_at)}` : ""}</span>
                </div>
                {item.link_url ? (
                  <p>
                    <a href={item.link_url} target="_blank" rel="noopener noreferrer">
                      {item.link_url}
                    </a>
                  </p>
                ) : null}
                <div className={`submission ${item.body.trim() ? "" : "empty"}`}>
                  {item.body.trim() || (item.link_url ? "" : "No written response.")}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No assignment submissions yet.</p>
        )}
      </section>

      <BmcrEvaluationsPanel studentId={student.id} />

      <section className="card">
        <h2>Survey responses</h2>
        {surveyPacks.length ? (
          <div className="work-list">
            {surveyPacks.map((pack) => (
              <div className="work-item" key={pack.title}>
                <div className="work-head">
                  <strong>{pack.title}</strong>
                </div>
                {pack.answers.map((item) => (
                  <div className="score-row" key={item.label}>
                    <span>{item.label}</span>
                    <b>{item.value}</b>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <p className="empty">No survey responses submitted yet.</p>
        )}
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

      <AskCoachThread student={student} />
    </div>
  );
}
