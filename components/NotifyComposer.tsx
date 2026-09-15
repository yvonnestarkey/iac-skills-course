"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import ComposerBox from "@/components/ui/ComposerBox";
import { audienceCopy, postAnnouncement } from "@/lib/comms";
import {
  notificationRowsForStudents,
  resolveNotificationTargets,
} from "@/lib/notifications";
import { getSupabase } from "@/lib/supabase";
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

    const client = getSupabase();
    if (!client) {
      const error = "Supabase is not configured.";
      console.error(error);
      alert(error);
      setBusy(false);
      return;
    }

    const { data: sessionData, error: sessionError } = await client.auth.getUser();
    if (sessionError || !sessionData.user) {
      const error =
        "Sign in at /student/login with your coach account before sending. The demo coach switcher is not a Supabase session.";
      console.error(error, sessionError);
      alert(error);
      setBusy(false);
      return;
    }

    const targets = await resolveNotificationTargets({
      audience: notifyDraft.audience,
      recipientIds: notifyDraft.recipientIds,
      students: data.students.map((student) => ({ id: student.id, email: student.email })),
    });
    const rows = notificationRowsForStudents({
      students: targets,
      title: subject,
      message: body,
      kind: "announcement",
    });

    if (!rows.length) {
      const error = "No registered students to notify. Demo roster IDs are not saved to Supabase.";
      console.error(error, { recipientIds: notifyDraft.recipientIds, targets });
      alert(error);
      setBusy(false);
      return;
    }

    const { data: inserted, error } = await client.from("notifications").insert(rows).select("id");
    if (error) {
      console.error("Supabase notifications insert failed", error, rows);
      const fallback = await client.from("notifications").insert(
        rows.map((row) => ({
          user_id: row.user_id,
          student_id: row.student_id,
          student_email: row.student_email,
          from_role: row.from_role,
          kind: row.kind,
          body: row.body,
        }))
      ).select("id");
      if (fallback.error) {
        console.error("Supabase notifications insert fallback failed", fallback.error, rows);
        alert(`Could not save notifications: ${fallback.error.message}`);
        setNotice(`Could not save notifications: ${fallback.error.message}`);
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
      setNotice(`Sent to ${audienceCopy(notifyDraft.audience, fallback.data?.length || rows.length)}.`);
      setNotifyDraft(null);
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
    setNotice(`Sent to ${audienceCopy(notifyDraft.audience, inserted?.length || rows.length)}.`);
    setNotifyDraft(null);
    setBusy(false);
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
          <ComposerBox
            id="notify-body"
            value={body}
            onChange={setBody}
            placeholder="What should they know?"
            rows={5}
            disabled={busy}
          />
        </div>
        <div className="modal-actions">
          <button className="primary" onClick={send} disabled={!subject.trim() || !body.trim() || !count || busy}>
            {busy ? "Sending…" : "Send notification"}
          </button>
          <button className="ghost" onClick={() => setNotifyDraft(null)}>
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
}
