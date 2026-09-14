"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOwnInboxMessages, type InboxMessage } from "./inbox";
import {
  asNotificationList,
  fetchOwnNotifications,
  markOwnNotificationsRead,
  notificationFromRow,
  type StudentNotification,
} from "./notifications";
import { getSupabase } from "./supabase";
import { useStudentSession } from "./student-session";

export function useStudentInbox(): {
  messages: InboxMessage[];
  inboxWaiting: number;
  notifications: StudentNotification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
} {
  const { user } = useStudentSession();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [notifications, setNotifications] = useState<StudentNotification[]>([]);
  const items = useMemo(() => asNotificationList(notifications), [notifications]);

  useEffect(() => {
    if (!user?.id) return;
    const client = getSupabase();
    let cancelled = false;

    const load = async () => {
      try {
        const [inbox, notes] = await Promise.all([fetchOwnInboxMessages(), fetchOwnNotifications()]);
        if (cancelled) return;
        setMessages(Array.isArray(inbox.data) ? inbox.data.filter(Boolean) : []);
        setNotifications(asNotificationList(notes.data));
      } catch {
        if (!cancelled) {
          setMessages([]);
          setNotifications([]);
        }
      }
    };

    load();

    try {
      const channel = client
        ?.channel(`student-notifications:${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
          (payload) => {
            if (payload.eventType === "INSERT" && payload.new) {
              const next = notificationFromRow(payload.new);
              if (!next) return;
              setNotifications((current) => {
                const list = asNotificationList(current);
                return list.some((item) => item.id === next.id) ? list : [next, ...list];
              });
              return;
            }
            if (payload.eventType === "UPDATE" && payload.new) {
              const next = notificationFromRow(payload.new);
              if (!next) return;
              setNotifications((current) =>
                asNotificationList(current).map((item) => (item.id === next.id ? next : item))
              );
              return;
            }
            if (payload.eventType === "DELETE" && payload.old) {
              const id = String((payload.old as { id?: string }).id || "");
              if (id) setNotifications((current) => asNotificationList(current).filter((item) => item.id !== id));
            }
          }
        )
        .subscribe();

      return () => {
        cancelled = true;
        if (client && channel) client.removeChannel(channel);
      };
    } catch {
      return () => {
        cancelled = true;
      };
    }
  }, [user?.id]);

  const lastMessage = Array.isArray(messages) ? messages[messages.length - 1] : undefined;
  const inboxWaiting = lastMessage && lastMessage.from === "coach" ? 1 : 0;
  const unreadCount = items.filter((item) => !item.read).length;

  const markAllRead = useCallback(async () => {
    setNotifications((current) => asNotificationList(current).map((item) => (item.read ? item : { ...item, read: true })));
    try {
      await markOwnNotificationsRead();
    } catch {
      /* Keep the local empty/read state even if the table is missing. */
    }
  }, []);

  return { messages: Array.isArray(messages) ? messages : [], inboxWaiting, notifications: items, unreadCount, markAllRead };
}
