"use client";

import { useEffect } from "react";
import { Bell } from "lucide-react";
import { formatInboxTime } from "@/lib/inbox";
import { asNotificationList } from "@/lib/notifications";
import { useStudentInbox } from "@/lib/use-student-inbox";
import LinkedText from "@/components/ui/LinkedText";

export default function StudentNotificationsPage() {
  const inbox = useStudentInbox();
  const notifications = asNotificationList(inbox?.notifications);
  const markNotificationsRead = inbox?.markNotificationsRead;

  useEffect(() => {
    if (!notifications.some((item) => item && !item.read)) return;
    void markNotificationsRead?.();
  }, [notifications, markNotificationsRead]);

  if (!notifications.length) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Course notifications</p>
        <h1>Notifications</h1>
        <p className="lead">Announcements and assignment feedback from your coach appear here.</p>
        <p className="empty flex items-center gap-2 flex-wrap">
          <Bell size={18} aria-hidden="true" />
          No notifications yet.
        </p>
      </article>
    );
  }

  return (
    <article className="lesson-body wide">
      <p className="kicker">Course notifications</p>
      <h1>Notifications</h1>
      <p className="lead">Announcements and assignment feedback from your coach appear here.</p>
      <div className="work-list">
        {notifications.map((item) => (
          <article className={`work-item ${item.read ? "" : "notice-unread"}`} key={item.id}>
            <div className="work-head">
              <strong>
                <LinkedText text={item.title || "Notification"} />
              </strong>
              <span className="muted small">
                {item.type === "assignment_feedback" ? "Assignment feedback" : "Announcement"}
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
    </article>
  );
}
