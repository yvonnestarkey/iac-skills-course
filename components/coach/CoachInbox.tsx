"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ScheduleSendFields from "@/components/coach/ScheduleSendFields";
import InboxPdfPicker from "@/components/inbox/InboxPdfPicker";
import InboxThreadView from "@/components/inbox/InboxThreadView";
import ComposerBox from "@/components/ui/ComposerBox";
import LinkedText from "@/components/ui/LinkedText";
import StudentProfileLink from "@/components/coach/StudentProfileLink";
import { fetchLiveAssignmentLessons } from "@/lib/content";
import {
  canPostInboxMessage,
  fetchInboxMessages,
  formatInboxTime,
  groupInboxByStudent,
  inboxPreviewText,
  markCoachThreadRead,
  postInboxMessage,
  refreshCoachAlerts,
  uploadInboxPdf,
  type InboxKind,
  type InboxThread,
} from "@/lib/inbox";
import {
  createScheduledSend,
  emptyScheduleFields,
  scheduledSendFinished,
  scheduledWriteFromFields,
} from "@/lib/scheduled-sends";
import { useStore } from "@/lib/store";

export default function CoachInbox() {
  const { data } = useStore();
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [schedule, setSchedule] = useState(emptyScheduleFields);
  const [lessonId, setLessonId] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [assignmentLessons, setAssignmentLessons] = useState<{ id: string; title: string; chapter: string }[]>([]);

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
      return next.find((thread) => thread.queued)?.studentEmail || next[0]?.studentEmail || null;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      refreshCoachAlerts();
      await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    fetchLiveAssignmentLessons().then((lessons) => {
      setAssignmentLessons(
        lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
          chapter: lesson.chapter.title,
        }))
      );
    });
  }, []);

  const queue = useMemo(() => threads.filter((thread) => thread.queued), [threads]);
  const selected = useMemo(
    () => threads.find((thread) => thread.studentEmail === selectedEmail) || null,
    [threads, selectedEmail]
  );
  const waiting = queue.length;

  const identityFor = (thread: InboxThread) => {
    const match = data.students.find(
      (student) =>
        student.email.toLowerCase() === thread.studentEmail.toLowerCase() ||
        (thread.studentId && student.id === thread.studentId)
    );
    return { name: match?.name || thread.studentEmail, id: thread.studentId || match?.id || "" };
  };

  const send = async (kind: InboxKind) => {
    if (!selected || !canPostInboxMessage(text, Boolean(pdf))) return;
    const lesson = assignmentLessons.find((item) => item.id === lessonId);
    const context =
      kind === "feedback"
        ? lesson
          ? `${lesson.chapter} · ${lesson.title}`
          : "Assignment feedback"
        : "Coach reply";
    setBusy(true);
    setStatus("");
    const student = identityFor(selected);
    if (schedule.mode !== "now") {
      let pdfUrl = "";
      let pdfName = "";
      if (pdf) {
        const uploaded = await uploadInboxPdf(pdf, student.id);
        if (uploaded.ok === false) {
          setBusy(false);
          setStatus(uploaded.error);
          return;
        }
        pdfUrl = uploaded.url;
        pdfName = uploaded.name;
      }
      const planned = scheduledWriteFromFields(schedule, {
        channel: "message",
        messageKind: kind === "feedback" ? "feedback" : "reply",
        title: kind === "feedback" ? context : "Message from your coach",
        body: text,
        pdfUrl,
        pdfName,
        audience: "student",
        audienceLabel: student.name,
        recipients: [{ id: student.id, email: selected.studentEmail, name: student.name }],
      });
      if (planned.ok === false || !("write" in planned)) {
        setBusy(false);
        setStatus(planned.ok === false ? planned.error : "Could not schedule that message.");
        return;
      }
      const saved = await createScheduledSend(planned.write);
      setBusy(false);
      if (!saved.ok) {
        setStatus(saved.error || "Could not schedule that message.");
        return;
      }
      setText("");
      setPdf(null);
      setSchedule(emptyScheduleFields());
      if (scheduledSendFinished(saved.data)) {
        setStatus(kind === "feedback" ? "Feedback sent to the student dashboard." : "Reply sent.");
        refreshCoachAlerts();
        await load();
      } else {
        setStatus("Scheduled.");
      }
      return;
    }
    const result = await postInboxMessage({
      studentId: selected.studentId,
      studentEmail: selected.studentEmail,
      from: "coach",
      kind,
      body: text,
      context,
      lessonId: lessonId || undefined,
      file: pdf,
    });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not send.");
      return;
    }
    setText("");
    setPdf(null);
    setStatus(
      result.emailError
        ? `Saved in the classroom, but the student email was not sent. ${result.emailError}`
        : kind === "feedback"
          ? "Feedback sent to the student dashboard."
          : "Reply sent."
    );
    refreshCoachAlerts();
    await load();
  };

  const markRead = async () => {
    if (!selected) return;
    setBusy(true);
    setStatus("");
    const result = await markCoachThreadRead({
      studentId: selected.studentId,
      studentEmail: selected.studentEmail,
    });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not mark this as read.");
      return;
    }
    setStatus("Marked as read.");
    refreshCoachAlerts();
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
            queue.map((thread) => {
              const student = identityFor(thread);
              return (
                <div
                  key={thread.studentEmail}
                  className={`inbox-item ${thread.studentEmail === selectedEmail ? "active" : ""} ${
                    thread.waiting ? "waiting-item" : ""
                  }`}
                >
                  <strong>
                    <StudentProfileLink studentId={student.id}>{student.name}</StudentProfileLink>
                  </strong>
                  <button
                    type="button"
                    className="inbox-item-open"
                    onClick={() => {
                      setSelectedEmail(thread.studentEmail);
                      setStatus("");
                    }}
                  >
                    <span className="muted small">
                      {thread.waiting ? "Waiting · " : "Unread · "}
                      {formatInboxTime(thread.lastAt)}
                    </span>
                    <span className="inbox-preview">
                      <LinkedText
                        text={inboxPreviewText(thread.messages[thread.messages.length - 1] || { body: "", pdfName: null, pdfUrl: null })}
                        interactive={false}
                      />
                    </span>
                  </button>
                </div>
              );
            })
          ) : (
            <p className="empty">The queue is clear. Open a student profile to read older threads.</p>
          )}
        </aside>
        <section className="inbox-thread card">
          {selected ? (
            <>
              <div className="panel-head">
                <div>
                  <h2>
                    <StudentProfileLink studentId={identityFor(selected).id}>{identityFor(selected).name}</StudentProfileLink>
                  </h2>
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
              <InboxPdfPicker file={pdf} onChange={setPdf} disabled={busy} />
              <ScheduleSendFields value={schedule} onChange={setSchedule} disabled={busy} />
              <div className="actions">
                <button className="primary" type="button" disabled={busy || !canPostInboxMessage(text, Boolean(pdf))} onClick={() => send("reply")}>
                  {schedule.mode === "now" ? "Reply" : "Schedule reply"}
                </button>
                <button className="ghost" type="button" disabled={busy || !canPostInboxMessage(text, Boolean(pdf))} onClick={() => send("feedback")}>
                  {schedule.mode === "now" ? "Leave assignment feedback" : "Schedule assignment feedback"}
                </button>
                <button className="ghost" type="button" disabled={busy || !selected.queued} onClick={() => void markRead()}>
                  Mark as read
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
