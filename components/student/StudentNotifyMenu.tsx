"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatInboxTime } from "@/lib/inbox";
import { useStudentInbox } from "@/lib/use-student-inbox";

function itemTitle(title: string, message: string): string {
  const heading = title.trim();
  if (heading) return heading;
  return message.replace(/\s+/g, " ").trim().slice(0, 80) || "Notification";
}

export default function StudentNotifyMenu() {
  const { notifications, unreadCount } = useStudentInbox();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
          {notifications.length ? (
            notifications.map((item) => (
              <button
                className={`notify-panel-item ${item.read ? "" : "notice-unread"}`}
                type="button"
                key={item.id}
                onClick={() => {
                  setOpen(false);
                  router.push(`/student/notifications/${item.id}`);
                }}
              >
                <strong>{itemTitle(item.title || "", item.message || "")}</strong>
                <span className="muted small">
                  {formatInboxTime(item.createdAt)}
                  {item.read ? "" : " · unread"}
                </span>
              </button>
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
            Open notifications
          </button>
        </div>
      ) : null}
    </div>
  );
}
