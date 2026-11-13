"use client";

import { useState } from "react";
import ScheduleSendFields from "@/components/coach/ScheduleSendFields";
import InboxPdfPicker from "@/components/inbox/InboxPdfPicker";
import ComposerBox from "@/components/ui/ComposerBox";
import LinkedText from "@/components/ui/LinkedText";
import { canPostInboxMessage, postInboxMessagesToStudents, uploadInboxPdf } from "@/lib/inbox";
import {
  createScheduledSend,
  emptyScheduleFields,
  scheduledSendFinished,
  scheduledWriteFromFields,
} from "@/lib/scheduled-sends";
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
  const [pdf, setPdf] = useState<File | null>(null);
  const [schedule, setSchedule] = useState(emptyScheduleFields);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const count = students.length;
  const names = students.map((student) => student.name).join(", ");

  const send = async () => {
    if (!canPostInboxMessage(body, Boolean(pdf)) || !count || busy) return;
    setBusy(true);
    setError("");
    let pdfUrl = "";
    let pdfName = "";
    if (pdf && schedule.mode !== "now") {
      const uploaded = await uploadInboxPdf(pdf, students[0]?.id);
      if (uploaded.ok === false) {
        setBusy(false);
        setError(uploaded.error);
        return;
      }
      pdfUrl = uploaded.url;
      pdfName = uploaded.name;
    }
    const planned = scheduledWriteFromFields(schedule, {
      channel: "message",
      body,
      pdfUrl,
      pdfName,
      audience: count === 1 ? "student" : "filtered",
      audienceLabel: names,
      recipients: students.map((student) => ({ id: student.id, email: student.email, name: student.name })),
    });
    if (planned.ok === false) {
      setBusy(false);
      setError(planned.error);
      return;
    }
    if ("write" in planned) {
      const saved = await createScheduledSend(planned.write);
      setBusy(false);
      if (!saved.ok) {
        setError(saved.error || "Could not schedule that message.");
        return;
      }
      if (scheduledSendFinished(saved.data)) onSent(count);
      onClose();
      return;
    }
    const result = await postInboxMessagesToStudents(
      students.map((student) => ({ id: student.id, email: student.email })),
      body,
      pdf
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
    if (result.emailError) {
      setError(`Saved in the classroom, but the student email was not sent. ${result.emailError}`);
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
            <button className="primary" onClick={() => void send()} disabled={!canPostInboxMessage(body, Boolean(pdf)) || !count || busy}>
              {busy ? "Sending…" : schedule.mode === "now" ? `Send message${count ? ` (${count})` : ""}` : "Schedule message"}
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
            <InboxPdfPicker file={pdf} onChange={setPdf} disabled={busy} />
            <ScheduleSendFields value={schedule} onChange={setSchedule} disabled={busy} />
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
