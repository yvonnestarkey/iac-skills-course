"use client";

import { useState } from "react";
import ComposerBox from "@/components/ui/ComposerBox";
import LinkedText from "@/components/ui/LinkedText";
import { postInboxMessagesToStudents } from "@/lib/inbox";
import type { Student } from "@/lib/types";

export default function ActivityMessageModal({
  students,
  onClose,
  onSent,
}: {
  students: Student[];
  onClose: () => void;
  onSent: (sent: number) => void;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = students.length;
  const names = students.map((student) => student.name).join(", ");

  const send = async () => {
    if (!body.trim() || !count || busy) return;
    setBusy(true);
    setError("");
    const result = await postInboxMessagesToStudents(
      students.map((student) => ({ id: student.id, email: student.email })),
      body
    );
    setBusy(false);
    if (result.sent) onSent(result.sent);
    if (!result.ok) {
      setError(
        result.sent
          ? `Sent to ${result.sent} of ${count}. ${result.error || "Could not send the rest."}`
          : result.error || "Could not send."
      );
      return;
    }
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <section className="modal notify-modal" role="dialog" aria-label="Message students">
        <div className="notify-modal-head">
          <div>
            <h2>Message students</h2>
            <p>
              To <strong>{count} student{count === 1 ? "" : "s"}</strong>
              <span className="muted"> · each gets this in their inbox thread</span>
            </p>
          </div>
          <div className="notify-modal-actions">
            <button className="primary" onClick={() => void send()} disabled={!body.trim() || !count || busy}>
              {busy ? "Sending…" : `Send message${count ? ` (${count})` : ""}`}
            </button>
            <button className="ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
        <div className="notify-modal-body">
          {names ? <p className="muted small">{names}</p> : null}
          {error ? <p className="notice">{error}</p> : null}
          <div className="plan-field">
            <label htmlFor="activity-message-body">
              <strong>Message</strong>
            </label>
            <ComposerBox
              id="activity-message-body"
              value={body}
              onChange={setBody}
              placeholder="Write to this group. Paste a lesson URL or insert a link."
              rows={6}
              disabled={busy}
            />
            {body.trim() ? (
              <div className="notify-preview">
                <p className="muted small">Preview</p>
                <p className="notice-body">
                  <LinkedText text={body} />
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
