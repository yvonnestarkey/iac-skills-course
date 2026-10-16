"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ComposerBox from "@/components/ui/ComposerBox";
import LinkedText from "@/components/ui/LinkedText";
import { audienceCopy, postAnnouncement } from "@/lib/comms";
import { insertCoachNotifications, resolveNotificationTargets } from "@/lib/notifications";
import { useStore } from "@/lib/store";

export default function NotifyComposer() {
  const { data, notifyDraft, setNotifyDraft, mutate, setNotice } = useStore();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setSubject(notifyDraft?.subject || "");
    setBody("");
  }, [notifyDraft]);

  if (pathname.startsWith("/student") || !notifyDraft) return null;

  const recipients = data.students.filter((s) => notifyDraft.recipientIds.includes(s.id));
  const count = Math.max(recipients.length, notifyDraft.recipientIds.length);

  const send = async () => {
    if (!subject.trim() || !body.trim() || !count || busy) return;
    setBusy(true);

    const targets = await resolveNotificationTargets({
      audience: notifyDraft.audience,
      recipientIds: notifyDraft.recipientIds,
      students: data.students.map((student) => ({
        id: student.id,
        email: student.email,
        cohort: student.cohort,
        name: student.name,
      })),
    });
    const result = await insertCoachNotifications({
      students: targets,
      title: subject,
      message: body,
      kind: "announcement",
      audience: notifyDraft.audience,
    });
    if (!result.ok) {
      const error = result.error || "Could not save notifications.";
      console.error(error, { recipientIds: notifyDraft.recipientIds, targets });
      alert(error);
      setNotice(error);
      setBusy(false);
      return;
    }

    mutate((draft) => {
      postAnnouncement(draft, {
        subject,
        body,
        audience: notifyDraft.audience,
        audienceLabel: notifyDraft.audienceLabel,
        recipientIds: notifyDraft.recipientIds,
      });
    });
    setNotice(`Sent to ${audienceCopy(notifyDraft.audience, result.count)}.`);
    setNotifyDraft(null);
    setBusy(false);
  };

  return (
    <div className="modal-backdrop">
      <section className="modal notify-modal" role="dialog" aria-label="Send a course announcement">
        <div className="notify-modal-head">
          <div>
            <h2>Send a notification</h2>
            <p>
              To <strong>{notifyDraft.audienceLabel}</strong>
              {notifyDraft.audience !== "student" ? (
                <span className="muted"> · {audienceCopy(notifyDraft.audience, count)}</span>
              ) : null}
            </p>
          </div>
          <div className="notify-modal-actions">
            <button className="primary" onClick={send} disabled={!subject.trim() || !body.trim() || !count || busy}>
              {busy ? "Sending…" : "Send notification"}
            </button>
            <button className="ghost" onClick={() => setNotifyDraft(null)}>
              Cancel
            </button>
          </div>
        </div>
        <div className="notify-modal-body">
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
            <ComposerBox
              id="notify-body"
              value={body}
              onChange={setBody}
              placeholder="What should they know? Paste a lesson URL or insert a link."
              rows={5}
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
