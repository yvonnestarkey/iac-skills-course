"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import LinkedText from "@/components/ui/LinkedText";
import { formatInboxTime } from "@/lib/inbox";
import { fetchStudentNotifications, type StudentNotification } from "@/lib/notifications";
import { fetchRosterStudent } from "@/lib/profiles";
import { useStore } from "@/lib/store";
import type { Student } from "@/lib/types";

export default function StudentNotificationsPage({ studentId }: { studentId: string }) {
  const router = useRouter();
  const { notice, setNotifyDraft } = useStore();
  const [student, setStudent] = useState<Student | null>(null);
  const [items, setItems] = useState<StudentNotification[]>([]);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRosterStudent(studentId).then(async (found) => {
      if (cancelled) return;
      setStudent(found);
      if (!found) {
        setReady(true);
        return;
      }
      const result = await fetchStudentNotifications({ id: found.id, email: found.email });
      if (cancelled) return;
      setItems(result.data);
      setError(result.ok ? "" : result.error || "Could not load notifications.");
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [studentId]);

  if (!ready) {
    return (
      <div className="coach-page">
        <button className="back-link" type="button" onClick={() => router.push(`/coach/students/${studentId}`)}>
          ← Back to profile
        </button>
        <p className="empty">Loading notifications…</p>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="coach-page">
        <button className="back-link" type="button" onClick={() => router.push("/coach/lists")}>
          ← Back to dashboard
        </button>
        <p className="empty">No such student.</p>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push(`/coach/students/${student.id}`)}>
        ← Back to {student.name.split(" ")[0]}&apos;s profile
      </button>
      {notice ? <div className="notice">{notice}</div> : null}
      <section className="card">
        <div className="panel-head">
          <div>
            <p className="kicker">Notifications</p>
            <h1>{student.name}</h1>
            <p className="muted small">Announcements and assignment feedback sent to {student.name.split(" ")[0]}.</p>
          </div>
          <button
            className="primary"
            type="button"
            onClick={() =>
              setNotifyDraft({
                audience: "student",
                audienceLabel: student.name,
                recipientIds: [student.id],
              })
            }
          >
            Send notification
          </button>
        </div>
        {error ? <p className="notice">{error}</p> : null}
        {items.length ? (
          <div className="work-list">
            {items.map((item) => (
              <article className={`work-item ${item.read ? "" : "notice-unread"}`} key={item.id}>
                <div className="work-head">
                  <strong>
                    <LinkedText text={item.title || "Notification"} />
                  </strong>
                  <span className="muted small">
                    {item.type === "assignment_feedback" ? "Assignment feedback" : "Announcement"}
                    {item.read ? "" : " · unread"}
                  </span>
                </div>
                {item.message ? (
                  <p className="notice-body">
                    <LinkedText text={item.message} />
                  </p>
                ) : null}
                <p className="muted small">{formatInboxTime(item.createdAt)}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">No notifications to this student yet.</p>
        )}
      </section>
    </div>
  );
}
