"use client";

import { useState } from "react";
import { authorName, markRead, postReply, recipientSummary } from "@/lib/comms";
import { useStore } from "@/lib/store";
import type { Communication } from "@/lib/types";
import LinkedText from "@/components/ui/LinkedText";

interface Props {
  comm: Communication;
  readerId: string;
  readerRole: "coach" | "student";
}

export default function AuditThread({ comm, readerId, readerRole }: Props) {
  const { data, mutate } = useStore();
  const [reply, setReply] = useState("");

  const send = () => {
    const text = reply.trim();
    if (!text) return;
    mutate((draft) => {
      postReply(draft, comm.id, readerRole, readerId, text);
      markRead(draft, comm.id, readerId);
    });
    setReply("");
  };

  const open = () => {
    if (!comm.readBy.includes(readerId)) {
      mutate((draft) => markRead(draft, comm.id, readerId));
    }
  };

  const unread =
    readerRole === "student"
      ? !comm.readBy.includes(readerId)
      : Boolean(comm.replies.length && comm.replies[comm.replies.length - 1].from === "student" && !comm.readBy.includes("coach"));

  return (
    <article className={`work-item comm-thread ${unread ? "unread" : ""}`} onClick={open}>
      <div className="work-head">
        <strong>
          <LinkedText text={comm.subject} />
        </strong>
        <span className="muted small">
          {recipientSummary(data, comm)} · {comm.at}
        </span>
      </div>
      <div className={`bubble coach`}>
        <LinkedText text={comm.body} />
        <div className="muted small">{comm.at} · Yvonne · announcement</div>
      </div>
      {comm.replies.map((item) => (
        <div className={`bubble ${item.from}`} key={item.id}>
          <LinkedText text={item.text} />
          <div className="muted small">
            {item.at} · {authorName(data, item)}
          </div>
        </div>
      ))}
      <div className="compose">
        <input
          type="text"
          placeholder={readerRole === "coach" ? "Reply in this thread…" : "Reply to Yvonne…"}
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") send();
          }}
        />
        <button className="primary" onClick={send}>
          Reply
        </button>
      </div>
    </article>
  );
}
