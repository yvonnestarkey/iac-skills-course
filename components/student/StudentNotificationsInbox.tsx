"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import LinkedText from "@/components/ui/LinkedText";
import { formatInboxTime } from "@/lib/inbox";
import { asNotificationList, type StudentNotification } from "@/lib/notifications";
import { useStudentInbox } from "@/lib/use-student-inbox";

function typeLabel(item: StudentNotification): string {
  return item.type === "assignment_feedback" ? "Assignment feedback" : "Announcement";
}

function itemTitle(item: StudentNotification): string {
  const title = (item.title || "").trim();
  if (title) return title;
  const message = (item.message || "").replace(/\s+/g, " ").trim();
  return message.slice(0, 80) || "Notification";
}

function NotificationBody({ item }: { item: StudentNotification }) {
  return (
    <article className={`work-item ${item.read ? "" : "notice-unread"}`} key={item.id}>
      <div className="work-head">
        <strong>
          <LinkedText text={itemTitle(item)} />
        </strong>
        <span className="muted small">{typeLabel(item)}</span>
      </div>
      {item.message ? (
        <p className="notice-body">
          <LinkedText text={item.message} />
        </p>
      ) : null}
      <p className="muted small">{formatInboxTime(item.createdAt)}</p>
    </article>
  );
}

export default function StudentNotificationsInbox({ selectedId }: { selectedId?: string }) {
  const router = useRouter();
  const inbox = useStudentInbox();
  const notifications = asNotificationList(inbox?.notifications);
  const ready = inbox?.ready !== false;
  const [readAll, setReadAll] = useState(false);
  const selected = useMemo(
    () => notifications.find((item) => item.id === selectedId) || null,
    [notifications, selectedId]
  );

  useEffect(() => {
    if (!selectedId || !selected) return;
    if (selected.read) return;
    void inbox.markNotificationsRead([selected.id]);
  }, [inbox, selected, selectedId]);

  useEffect(() => {
    if (!readAll) return;
    if (!notifications.some((item) => !item.read)) return;
    void inbox.markNotificationsRead();
  }, [inbox, notifications, readAll]);

  if (!ready) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Course notifications</p>
        <h1>Notifications</h1>
        <p className="empty">Loading notifications…</p>
      </article>
    );
  }

  if (!notifications.length) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Course notifications</p>
        <h1>Notifications</h1>
        <p className="lead">Announcements and assignment feedback from your coach stay here, including anything sent to your cohort before you joined.</p>
        <p className="empty flex items-center gap-2 flex-wrap">
          <Bell size={18} aria-hidden="true" />
          No notifications yet.
        </p>
      </article>
    );
  }

  if (readAll) {
    return (
      <article className="lesson-body wide">
        <button className="back-link" type="button" onClick={() => setReadAll(false)}>
          ← Back to notifications
        </button>
        <p className="kicker">Course notifications</p>
        <h1>All notifications</h1>
        <p className="lead">Every announcement and coach note in one place.</p>
        <div className="work-list">
          {notifications.map((item) => (
            <NotificationBody item={item} key={item.id} />
          ))}
        </div>
      </article>
    );
  }

  if (selectedId) {
    return (
      <article className="lesson-body wide">
        <button className="back-link" type="button" onClick={() => router.push("/student/notifications")}>
          ← Back to notifications
        </button>
        <p className="kicker">Course notifications</p>
        <h1>{selected ? itemTitle(selected) : "Notification"}</h1>
        {selected ? (
          <div className="work-list">
            <NotificationBody item={selected} />
          </div>
        ) : (
          <p className="empty">That notification is not in your inbox.</p>
        )}
      </article>
    );
  }

  return (
    <article className="lesson-body wide">
      <p className="kicker">Course notifications</p>
      <div className="panel-head">
        <div>
          <h1>Notifications</h1>
          <p className="lead">Open one to read it, or read every notification in one place.</p>
        </div>
        <button className="ghost" type="button" onClick={() => setReadAll(true)}>
          Read all
        </button>
      </div>
      <div className="work-list">
        {notifications.map((item) => (
          <button
            className={`work-item notify-inbox-item ${item.read ? "" : "notice-unread"}`}
            type="button"
            key={item.id}
            onClick={() => router.push(`/student/notifications/${item.id}`)}
          >
            <div className="work-head">
              <strong>{itemTitle(item)}</strong>
              <span className="muted small">{formatInboxTime(item.createdAt)}</span>
            </div>
            <p className="muted small">{typeLabel(item)}{item.read ? "" : " · unread"}</p>
          </button>
        ))}
      </div>
    </article>
  );
}
