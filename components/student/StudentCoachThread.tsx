"use client";

import { useCallback, useEffect, useState } from "react";
import InboxThreadView from "@/components/inbox/InboxThreadView";
import ComposerBox from "@/components/ui/ComposerBox";
import { fetchOwnInboxMessages, isWaiting, postInboxMessage, type InboxMessage } from "@/lib/inbox";
import { useStudentSession } from "@/lib/student-session";

export default function StudentCoachThread({
  context,
  lessonId,
  title = "Messages with your coach",
  compact = false,
}: {
  context?: string;
  lessonId?: string;
  title?: string;
  compact?: boolean;
}) {
  const { user } = useStudentSession();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const result = await fetchOwnInboxMessages();
    if (result.ok) setMessages(result.data);
    else setStatus(result.error || "Could not load messages.");
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const send = async () => {
    if (!user?.email || !text.trim()) return;
    setBusy(true);
    setStatus("");
    const result = await postInboxMessage({
      studentId: user.id,
      studentEmail: user.email,
      from: "student",
      kind: "question",
      body: text,
      context: context || "Student dashboard",
      lessonId,
    });
    setBusy(false);
    if (!result.ok) {
      setStatus(result.error || "Could not send.");
      return;
    }
    if (result.message) setMessages((current) => [...current, result.message!]);
    setText("");
    setStatus("Sent. Your coach will see this in Inbox.");
  };

  return (
    <section className={compact ? "student-inbox compact" : "student-inbox"}>
      <h2>{title}</h2>
      {isWaiting(messages) ? <div className="waiting">Your latest message is waiting for the coach.</div> : null}
      {status ? <p className="notice">{status}</p> : null}
      <InboxThreadView messages={messages} viewer="student" empty="No messages yet. Ask a question below." />
      <ComposerBox
        value={text}
        onChange={setText}
        placeholder="What do you need help with?"
        rows={compact ? 3 : 4}
        disabled={busy}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
        }}
      />
      <div className="actions">
        <button className="primary" type="button" disabled={busy || !text.trim()} onClick={send}>
          Send to coach
        </button>
      </div>
    </section>
  );
}
