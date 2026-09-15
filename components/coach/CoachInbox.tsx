"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import InboxThreadView from "@/components/inbox/InboxThreadView";
import ComposerBox from "@/components/ui/ComposerBox";
import { SEED } from "@/lib/seed";
import {
  fetchInboxMessages,
  formatInboxTime,
  groupInboxByStudent,
  postInboxMessage,
  type InboxKind,
  type InboxThread,
} from "@/lib/inbox";
import { useStore } from "@/lib/store";

const assignmentLessons = SEED.chapters.flatMap((chapter) =>
  chapter.lessons
    .filter((lesson) => lesson.type === "assignment" || lesson.type === "upload")
    .map((lesson) => ({ id: lesson.id, title: lesson.title, chapter: chapter.title }))
);

export default function CoachInbox() {
  const { data } = useStore();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const result = await fetchInboxMessages();
    if (!result.ok) {
      setError(result.error || "Could not load the inbox.");
      return;
    }
    setError("");
    const next = groupInboxByStudent(result.data);
    setThreads(next);
    setSelectedEmail((current) => {
      if (current && next.some((thread) => thread.studentEmail === current)) return current;
      return next.find((thread) => thread.queued)?.studentEmail || null;
    });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const queue = useMemo(() => threads.filter((thread) => thread.queued), [threads]);
  const selected = useMemo(
    () => threads.find((thread) => thread.studentEmail === selectedEmail) || null,
    [threads, selectedEmail]
  );
  const waiting = queue.length;

  const labelFor = (thread: InboxThread) => {
    const match = data.students.find(
      (student) =>
        student.email.toLowerCase() === thread.studentEmail.toLowerCase() ||
        (thread.studentId && student.id === thread.studentId)
    );
    return match?.name || thread.studentEmail;
  };

  const send = async (kind: InboxKind) => {
    if (!selected || !text.trim()) return;
    const lesson = assignmentLessons.find((item) => item.id === lessonId);
    const context =
      kind === "feedback"
        ? lesson
          ? `${lesson.chapter} · ${lesson.title}`
          : "Assignment feedback"
        : "Coach reply";
    setBusy(true);
    setStatus("");
    const result = await postInboxMessage({
      studentId: selected.studentId,
      studentEmail: selected.studentEmail,
      from: "coach",
      kind,
      body: text,
      context,
      lessonId: lessonId || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not send.");
      return;
    }
    setText("");
    setStatus(kind === "feedback" ? "Feedback sent to the student dashboard." : "Reply sent.");
    await load();
  };

  return (
    <div className="inbox-board">
      {error ? <div className="notice">{error} Run the inbox_messages SQL in Supabase if this table is new.</div> : null}
      {waiting ? (
        <div className="dash-alert">
          {waiting} student{waiting === 1 ? "" : "s"} waiting on a reply.
        </div>
      ) : null}
      <div className="inbox-layout">
        <aside className="inbox-list" aria-label="Students waiting on a reply">
          {queue.length ? (
            queue.map((thread) => (
              <button
                key={thread.studentEmail}
                className={`inbox-item ${thread.studentEmail === selectedEmail ? "active" : ""} ${
                  thread.waiting ? "waiting-item" : ""
                }`}
                type="button"
                onClick={() => {
                  setSelectedEmail(thread.studentEmail);
                  setStatus("");
                }}
              >
                <strong>{labelFor(thread)}</strong>
                <span className="muted small">
                  {thread.waiting ? "Waiting · " : "Unread · "}
                  {formatInboxTime(thread.lastAt)}
                </span>
                <span className="inbox-preview">{thread.messages[thread.messages.length - 1]?.body}</span>
              </button>
            ))
          ) : (
            <p className="empty">The queue is clear. Open a student profile to read older threads.</p>
          )}
        </aside>
        <section className="inbox-thread card">
          {selected ? (
            <>
              <div className="panel-head">
                <div>
                  <h2>{labelFor(selected)}</h2>
                  <p className="muted small">
                    {selected.queued ? "Waiting for your reply" : "Replied · removed from the queue"} ·{" "}
                    {selected.messages.length} message{selected.messages.length === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <InboxThreadView messages={selected.messages} viewer="coach" />
              {status ? <p className="notice">{status}</p> : null}
              <label className="student-notes-label" htmlFor="inbox-lesson">
                Optional assignment
              </label>
              <select id="inbox-lesson" value={lessonId} onChange={(event) => setLessonId(event.target.value)}>
                <option value="">None — general reply</option>
                {assignmentLessons.map((lesson) => (
                  <option key={lesson.id} value={lesson.id}>
                    {lesson.title}
                  </option>
                ))}
              </select>
              <ComposerBox
                value={text}
                onChange={setText}
                placeholder="Reply to this student, or leave assignment feedback…"
                rows={4}
                disabled={busy}
              />
              <div className="actions">
                <button className="primary" type="button" disabled={busy || !text.trim()} onClick={() => send("reply")}>
                  Reply
                </button>
                <button className="ghost" type="button" disabled={busy || !text.trim()} onClick={() => send("feedback")}>
                  Leave assignment feedback
                </button>
              </div>
            </>
          ) : (
            <p className="empty">Select a waiting student, or open a profile to message them.</p>
          )}
        </section>
      </div>
    </div>
  );
}
