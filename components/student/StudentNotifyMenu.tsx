"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import LinkedText from "@/components/ui/LinkedText";
import { formatInboxTime } from "@/lib/inbox";
import { useStudentInbox } from "@/lib/use-student-inbox";

export default function StudentNotifyMenu() {
  const { notifications, unreadCount, markNotificationsRead } = useStudentInbox();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const recent = notifications.slice(0, 6);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open || unreadCount === 0) return;
    void markNotificationsRead();
  }, [open, unreadCount, markNotificationsRead]);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="notify-menu" ref={rootRef}>
      <button
        className={`notify-btn ${pathname.startsWith("/student/notifications") || open ? "on" : ""}`}
        type="button"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 ? <span className="notify-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>
      {open ? (
        <div className="notify-panel" role="dialog" aria-label="Course notifications">
          {recent.length ? (
            recent.map((item) => (
              <article className={`notify-panel-item ${item.read ? "" : "notice-unread"}`} key={item.id}>
                <strong>
                  <LinkedText text={item.title || "Notification"} />
                </strong>
                {item.message ? (
                  <p className="notice-body">
                    <LinkedText text={item.message} />
                  </p>
                ) : null}
                <span className="muted small">{formatInboxTime(item.createdAt)}</span>
              </article>
            ))
          ) : (
            <p className="empty">No notifications yet.</p>
          )}
          <button
            className="ghost"
            type="button"
            onClick={() => {
              setOpen(false);
              router.push("/student/notifications");
            }}
          >
            View all notifications
          </button>
        </div>
      ) : null}
    </div>
  );
}
