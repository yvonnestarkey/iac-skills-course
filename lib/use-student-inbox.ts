"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchOwnInboxMessages, type InboxMessage } from "./inbox";
import {
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

  useEffect(() => {
    if (!user?.id) return;
    const client = getSupabase();
    let cancelled = false;

    const load = async () => {
      const [inbox, notes] = await Promise.all([fetchOwnInboxMessages(), fetchOwnNotifications()]);
      if (cancelled) return;
      if (inbox.ok) setMessages(inbox.data);
      if (notes.ok) setNotifications(notes.data);
    };

    load();

    const channel = client
      ?.channel(`student-notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === "INSERT" && payload.new) {
            const next = notificationFromRow(payload.new);
            setNotifications((current) => (current.some((item) => item.id === next.id) ? current : [next, ...current]));
            return;
          }
          if (payload.eventType === "UPDATE" && payload.new) {
            const next = notificationFromRow(payload.new);
            setNotifications((current) => current.map((item) => (item.id === next.id ? next : item)));
            return;
          }
          if (payload.eventType === "DELETE" && payload.old) {
            const id = String((payload.old as { id?: string }).id || "");
            if (id) setNotifications((current) => current.filter((item) => item.id !== id));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      if (client && channel) client.removeChannel(channel);
    };
  }, [user?.id]);

  const last = messages[messages.length - 1];
  const inboxWaiting = last && last.from === "coach" ? 1 : 0;
  const unreadCount = notifications.filter((item) => !item.read).length;

  const markAllRead = useCallback(async () => {
    setNotifications((current) => current.map((item) => (item.read ? item : { ...item, read: true })));
    await markOwnNotificationsRead();
  }, []);

  return { messages, inboxWaiting, notifications, unreadCount, markAllRead };
}
