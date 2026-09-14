"use client";

import { useEffect } from "react";
import { formatInboxTime } from "@/lib/inbox";
import { useStudentInbox } from "@/lib/use-student-inbox";

export default function StudentNotificationsPage() {
  const { notifications, markAllRead } = useStudentInbox();

  useEffect(() => {
    if (!notifications.some((item) => !item.read)) return;
    markAllRead();
  }, [notifications, markAllRead]);

  return (
    <article className="lesson-body wide">
      <p className="kicker">Course notifications</p>
      <h1>Notifications</h1>
      <p className="lead">Announcements and assignment feedback from your coach appear here.</p>
      <div className="work-list">
        {notifications.length ? (
          notifications.map((item) => (
            <article className={`work-item ${item.read ? "" : "notice-unread"}`} key={item.id}>
              <div className="work-head">
                <strong>{item.title}</strong>
                <span className="muted small">
                  {item.type === "assignment_feedback" ? "Assignment feedback" : "Announcement"}
                </span>
              </div>
              <p>{item.message}</p>
              <p className="muted small">{formatInboxTime(item.createdAt)}</p>
            </article>
          ))
        ) : (
          <p className="empty">No notifications yet. When your coach sends an announcement or feedback, it will show here.</p>
        )}
      </div>
    </article>
  );
}
