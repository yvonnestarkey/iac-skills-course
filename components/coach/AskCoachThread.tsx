"use client";

import { useCallback, useEffect, useState } from "react";
import InboxPdfPicker from "@/components/inbox/InboxPdfPicker";
import InboxThreadView from "@/components/inbox/InboxThreadView";
import ComposerBox from "@/components/ui/ComposerBox";
import LinkedText from "@/components/ui/LinkedText";
import {
  canPostInboxMessage,
  fetchCoachStudentThread,
  inboxPreviewText,
  isWaiting,
  markCoachThreadRead,
  postInboxMessage,
  refreshCoachAlerts,
  studentRowMatches,
  type InboxMessage,
} from "@/lib/inbox";
import { getSupabase } from "@/lib/supabase";
import type { Student } from "@/lib/types";

export default function AskCoachThread({ student }: { student: Student }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [text, setText] = useState("");
  const [pdf, setPdf] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const result = await fetchCoachStudentThread({ id: student.id, email: student.email });
    setMessages(result.data);
    if (!result.ok && result.error) setStatus(result.error);
    else setStatus("");
  }, [student.id, student.email]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    const channel = client
      .channel(`coach-ask-thread:${student.email || student.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications" }, (payload) => {
        const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
        if (studentRowMatches(row, { id: student.id, email: student.email })) load();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "inbox_messages" }, (payload) => {
        const row = (payload.new || payload.old) as Record<string, unknown> | undefined;
        if (studentRowMatches(row, { id: student.id, email: student.email })) load();
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [student.id, student.email, load]);

  const pending = isWaiting(messages);

  const send = async () => {
    if (!canPostInboxMessage(text, Boolean(pdf))) return;
    setBusy(true);
    setStatus("");
    const result = await postInboxMessage({
      studentId: student.id,
      studentEmail: student.email,
      from: "coach",
      kind: "reply",
      body: text,
      context: "Coach reply",
      file: pdf,
    });
    setBusy(false);
    if (!result.ok) {
      console.error("Coach reply failed", result.error);
      setStatus(result.error || "Could not send.");
      return;
    }
    setText("");
    setPdf(null);
    if (result.emailError) {
      setStatus(`Saved in the classroom, but the student email was not sent. ${result.emailError}`);
    }
    await load();
  };

  const markRead = async () => {
    setBusy(true);
    setStatus("");
    const result = await markCoachThreadRead({
      studentId: student.id,
      studentEmail: student.email,
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
    <section className="card">
      <h2>Message thread</h2>
      <p className="muted small">Complete history with {student.name}. Replies here also reach their student inbox.</p>
      {pending ? (
        <div className="waiting">
          Waiting on you: <LinkedText text={inboxPreviewText(messages[messages.length - 1] || { body: "", pdfName: null, pdfUrl: null })} />
        </div>
      ) : null}
      {status ? <p className="notice">{status}</p> : null}
      <InboxThreadView
        messages={messages}
        viewer="coach"
        empty="No questions or messages yet."
      />
      <ComposerBox
        id="coach-msg"
        value={text}
        onChange={setText}
        placeholder={pending ? "Answer this question…" : `Message ${student.name.split(" ")[0]}…`}
        rows={4}
        disabled={busy}
      />
      <InboxPdfPicker file={pdf} onChange={setPdf} disabled={busy} />
      <div className="actions">
        <button className="primary" id="send-coach" type="button" disabled={busy || !canPostInboxMessage(text, Boolean(pdf))} onClick={send}>
          {pending ? "Reply" : "Send message"}
        </button>
        {pending ? (
          <button className="ghost" type="button" disabled={busy} onClick={() => void markRead()}>
            Mark as read
          </button>
        ) : null}
      </div>
    </section>
  );
}
