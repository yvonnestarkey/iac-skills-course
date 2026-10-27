"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ActivityGrid from "@/components/coach/ActivityGrid";
import AccountActivationBadge from "@/components/coach/AccountActivationBadge";
import CourseAccessBadge from "@/components/coach/CourseAccessBadge";
import SetTemporaryPasswordPanel from "@/components/coach/SetTemporaryPasswordPanel";
import StudentAccessPanel from "@/components/coach/StudentAccessPanel";
import BmcrEvaluationsPanel from "@/components/coach/BmcrEvaluationsPanel";
import ReadingAttemptsPanel from "@/components/coach/ReadingAttemptsPanel";
import ScriptEvaluationsPanel from "@/components/coach/ScriptEvaluationsPanel";
import { canSendPasswordSetupLink } from "@/lib/account-activation";
import { accountStatusLabel } from "@/lib/student-registration";
import { activityColumnsFromOutline, currentActivityPosition } from "@/lib/activity-grid";
import {
  activityLevel,
  activityLevelLabel,
  describeProgressReasons,
  engagementByLesson,
  type LessonEngagement,
} from "@/lib/lesson-progress";
import { fetchCoachProgressBundle, fetchLiveLessonIds, fetchRosterStudent } from "@/lib/profiles";
import type { Student } from "@/lib/types";
import { cohortName, initials, lastActiveLabel } from "@/lib/course";
import { formatSastDateTime, longDate, parseISO, today } from "@/lib/dates";
import { completionProgress } from "@/lib/metrics";
import { planCapacity, planStatus, slotLabel } from "@/lib/planner";
import { fetchCourseOutline, type OutlineChapter } from "@/lib/student-lesson";
import { fetchStudentSubmissions, type StudentSubmission } from "@/lib/student-submissions";
import { useStore } from "@/lib/store";

export default function StudentProfile({ studentId }: { studentId: string }) {
  const { data, notice } = useStore();
  const router = useRouter();
  const [note, setNote] = useState("");
  const [live, setLive] = useState<Student | null>(null);
  const [loadingLive, setLoadingLive] = useState(true);
  const [lessonIds, setLessonIds] = useState<string[]>([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [lessonTitles, setLessonTitles] = useState<Record<string, string>>({});
  const [engagement, setEngagement] = useState<LessonEngagement[]>([]);
  const [outline, setOutline] = useState<OutlineChapter[]>([]);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupNotice, setSetupNotice] = useState("");
  const [activityOpen, setActivityOpen] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingLive(true);
    Promise.all([
      fetchRosterStudent(studentId),
      fetchLiveLessonIds(),
      fetchStudentSubmissions(studentId),
      fetchCourseOutline(),
      fetchCoachProgressBundle(studentId),
    ]).then(([found, ids, submitted, outline, progress]) => {
      if (cancelled) return;
      setLive(found);
      setLessonIds(ids);
      setSubmissions(Object.values(submitted));
      const titles: Record<string, string> = {};
      const order: string[] = [];
      outline.forEach((chapter) => {
        chapter.lessons.forEach((lesson) => {
          titles[lesson.id] = lesson.title;
          order.push(lesson.id);
        });
      });
      setLessonTitles(titles);
      setOutline(outline);
      const rank = new Map(order.map((id, index) => [id, index]));
      const rows = [...(progress.byUser[studentId]?.lessons || [])].sort((a, b) => {
        return (rank.get(a.lessonId) ?? 9999) - (rank.get(b.lessonId) ?? 9999);
      });
      setEngagement(rows);
      setLoadingLive(false);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#activity") {
      setActivityOpen(true);
      window.requestAnimationFrame(() => document.getElementById("activity")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  }, [loadingLive, studentId]);

  const columns = useMemo(() => activityColumnsFromOutline(outline), [outline]);
  const position = useMemo(() => currentActivityPosition(columns, engagement), [columns, engagement]);
  const chapterGroups = useMemo(() => {
    const groups: { id: string; title: string; phaseLabel: string; columns: typeof columns }[] = [];
    columns.forEach((column) => {
      const last = groups[groups.length - 1];
      if (last && last.id === column.chapterId) last.columns.push(column);
      else {
        groups.push({
          id: column.chapterId,
          title: column.chapterTitle,
          phaseLabel: column.phaseLabel,
          columns: [column],
        });
      }
    });
    return groups;
  }, [columns]);
  const byLesson = useMemo(() => engagementByLesson(engagement), [engagement]);

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
  const openedCount = (student.opened || engagement.filter((item) => item.opened).map((item) => item.lessonId))
    .filter((id, index, list) => list.indexOf(id) === index && (!lessonIds.length || lessonIds.includes(id)))
    .length;
  const watchedCount = engagement.filter((item) => item.reasons.includes("watched")).length;
  const openedOnly = engagement.filter((item) => item.opened && !item.completed);
  const notStarted = Math.max(0, p.total - openedCount);
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
          <h1>
            {student.name} <CourseAccessBadge access={student.courseAccess} accessActive={student.accessActive} />{" "}
            <AccountActivationBadge status={student.accountActivation} />
          </h1>
          <p className="muted">
            {student.email} · {cohortName(data, student.cohort)} · joined {student.joined || "—"}
          </p>
        </div>
        <div className="profile-tags">
          <span className={`badge ${accountStatusLabel(student) === "Active" ? "ok" : "warn"}`}>
            {accountStatusLabel(student)}
          </span>
          <span className="muted small">Last active {lastActiveLabel(student)}</span>
          <button className="primary" type="button" onClick={() => router.push(`/coach/students/${student.id}/surveys`)}>
            Surveys
          </button>
          <button className="ghost" type="button" onClick={() => router.push(`/coach/students/${student.id}/messages`)}>
            Messages
          </button>
          <button className="ghost" type="button" onClick={() => router.push(`/coach/students/${student.id}/notifications`)}>
            Notifications
          </button>
          {canSendPasswordSetupLink(student.accountActivation) ? (
            <button
              className="ghost"
              type="button"
              disabled={setupBusy}
              onClick={async () => {
                setSetupBusy(true);
                setSetupNotice("");
                const response = await fetch("/api/coach/account-recovery", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ user_id: student.id, email: student.email }),
                });
                const payload = await response.json().catch(() => ({}));
                setSetupBusy(false);
                setSetupNotice(payload.message || payload.error || "Could not send the password setup link.");
              }}
            >
              {setupBusy ? "Sending…" : "Send password setup link"}
            </button>
          ) : null}
          {setupNotice ? <p className="muted small">{setupNotice}</p> : null}
        </div>
      </div>
      {notice ? <div className="notice">{notice}</div> : null}

      <StudentAccessPanel
        student={student}
        onUpdated={(next) => setLive((current) => (current ? { ...current, ...next } : current))}
      />

      <SetTemporaryPasswordPanel userId={student.id} studentName={student.name} />

      <section className="card" id="activity">
        <div className="panel-head">
          <button type="button" className="activity-progress-toggle" onClick={() => setActivityOpen((open) => !open)}>
            <div>
              <h2>Progress</h2>
              <p className="muted small">
                {p.done} of {p.total} lessons complete · {openedCount} opened
                {position.current
                  ? ` · currently on ${position.current.chapterTitle} · ${position.current.lessonLabel} ${position.current.title}`
                  : ""}
              </p>
            </div>
            <span className="score-chip">{p.pct}%</span>
          </button>
        </div>
        <div className="progress-wide">
          <span style={{ width: `${p.pct}%` }} />
        </div>
        <div className="progress-legend">
          <span>{p.done} complete</span>
          <span>{openedCount} opened</span>
          <span>{watchedCount} watched to 80%</span>
          <span>
            {submissions.length} assignment submission{submissions.length === 1 ? "" : "s"}
          </span>
          <span>{notStarted} not started</span>
        </div>
        {activityOpen ? (
          <>
            <p className="activity-here">
              {position.current
                ? `Currently on ${position.current.phaseLabel} · ${position.current.chapterTitle} · ${position.current.title}.`
                : "No lesson activity recorded yet."}
              {position.lastItem?.lastOpenedAt
                ? ` Last activity ${formatSastDateTime(position.lastItem.lastOpenedAt)}.`
                : ""}
            </p>
            <ActivityGrid
              columns={columns}
              rows={[{ student, byLesson }]}
              selectable={false}
            />
            <div className="progress-report">
              {chapterGroups.map((group) => (
                <div key={group.id} className="activity-chapter-block">
                  <h3>
                    {group.phaseLabel} · {group.title}
                  </h3>
                  <table>
                    <thead>
                      <tr>
                        <th>Lesson</th>
                        <th>Date</th>
                        <th>Watched</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.columns.map((column) => {
                        const item = byLesson[column.id];
                        const level = activityLevel(item);
                        return (
                          <tr key={column.id}>
                            <td>
                              <strong>
                                {column.lessonLabel} · {column.title}
                              </strong>
                              <span className={`badge ${level === "complete" ? "ok" : level === "none" ? "" : "warn"}`}>
                                {activityLevelLabel(level)}
                              </span>
                            </td>
                            <td>{item?.lastOpenedAt ? formatSastDateTime(item.lastOpenedAt) : "—"}</td>
                            <td>{item?.videoPercent ? `${item.videoPercent}%` : "—"}</td>
                            <td>{item ? describeProgressReasons(item.reasons) : "Not started"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
              {openedOnly.length ? (
                <p className="muted small">
                  {openedOnly.length} lesson{openedOnly.length === 1 ? "" : "s"} opened but not yet watched, submitted, or
                  marked complete.
                </p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="muted small">Click Progress to open the lesson-by-lesson activity report.</p>
        )}
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

      <ReadingAttemptsPanel studentId={student.id} />

      <ScriptEvaluationsPanel studentId={student.id} />

      <BmcrEvaluationsPanel studentId={student.id} />
    </div>
  );
}
