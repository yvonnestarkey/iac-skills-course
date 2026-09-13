"use client";

import { useEffect, useState } from "react";
import { audienceCopy, postAnnouncement } from "@/lib/comms";
import { useStore } from "@/lib/store";

export default function NotifyComposer() {
  const { data, notifyDraft, setNotifyDraft, mutate, setNotice } = useStore();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  useEffect(() => {
    setSubject(notifyDraft?.subject || "");
    setBody("");
  }, [notifyDraft]);

  if (!notifyDraft) return null;

  const recipients = data.students.filter((s) => notifyDraft.recipientIds.includes(s.id));
  const count = recipients.length;

  const send = () => {
    if (!subject.trim() || !body.trim() || !count) return;
    mutate((draft) => {
      postAnnouncement(draft, {
        subject,
        body,
        audience: notifyDraft.audience,
        audienceLabel: notifyDraft.audienceLabel,
        recipientIds: notifyDraft.recipientIds,
      });
    });
    setNotice(`Sent to ${audienceCopy(notifyDraft.audience, count)}.`);
    setNotifyDraft(null);
  };

  return (
    <div className="modal-backdrop">
      <section className="modal notify-modal" role="dialog" aria-label="Send a course announcement">
        <h2>Send a notification</h2>
        <p>
          To <strong>{notifyDraft.audienceLabel}</strong>
          {notifyDraft.audience !== "student" ? (
            <span className="muted"> · {audienceCopy(notifyDraft.audience, count)}</span>
          ) : null}
        </p>
        {notifyDraft.audience !== "student" && recipients.length ? (
          <p className="muted small">{recipients.map((s) => s.name).join(", ")}</p>
        ) : null}
        <div className="plan-field">
          <label htmlFor="notify-subject">
            <strong>Subject</strong>
          </label>
          <input
            id="notify-subject"
            type="text"
            className="select-line"
            placeholder="Thursday live session"
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            autoFocus
          />
        </div>
        <div className="plan-field">
          <label htmlFor="notify-body">
            <strong>Message</strong>
          </label>
          <textarea
            id="notify-body"
            rows={5}
            placeholder="What should they know?"
            value={body}
            onChange={(event) => setBody(event.target.value)}
          />
        </div>
        <p className="muted small">
          This is stored as a communication. Students can reply, and the whole thread stays here as an audit trail.
        </p>
        <div className="modal-actions">
          <button className="primary" onClick={send} disabled={!subject.trim() || !body.trim() || !count}>
            Send notification
          </button>
          <button className="ghost" onClick={() => setNotifyDraft(null)}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
