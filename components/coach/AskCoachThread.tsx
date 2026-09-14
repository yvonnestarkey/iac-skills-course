"use client";

import { useCallback, useEffect, useState } from "react";
import InboxThreadView from "@/components/inbox/InboxThreadView";
import {
  fetchCoachStudentThread,
  isWaiting,
  postInboxMessage,
  studentRowMatches,
  type InboxMessage,
} from "@/lib/inbox";
import { getSupabase } from "@/lib/supabase";
import type { Student } from "@/lib/types";

export default function AskCoachThread({ student }: { student: Student }) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [text, setText] = useState("");
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
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setStatus("");
    const result = await postInboxMessage({
      studentId: student.id,
      studentEmail: student.email,
      from: "coach",
      kind: "reply",
      body,
      context: "Ask the Coach",
    });
    setBusy(false);
    if (!result.ok) {
      console.error("Coach reply failed", result.error);
      setStatus(result.error || "Could not send.");
      return;
    }
    setText("");
    await load();
  };

  return (
    <section className="card">
      <h2>Ask the Coach</h2>
      {pending ? <div className="waiting">Waiting on you: {messages[messages.length - 1]?.body}</div> : null}
      {status ? <p className="notice">{status}</p> : null}
      <InboxThreadView
        messages={messages}
        viewer="coach"
        empty="No questions or messages yet."
      />
      <div className="compose">
        <input
          id="coach-msg"
          type="text"
          placeholder={pending ? "Answer this question…" : `Reply to ${student.name.split(" ")[0]}…`}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
        />
        <button className="primary" id="send-coach" type="button" disabled={busy || !text.trim()} onClick={send}>
          {pending ? "Reply" : "Send"}
        </button>
      </div>
    </section>
  );
}
