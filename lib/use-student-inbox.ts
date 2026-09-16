"use client";

import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchOwnInboxMessages, markOwnInboxRead, type InboxMessage } from "./inbox";
import {
  asNotificationList,
  fetchOwnNotifications,
  markOwnNotificationsRead,
  notificationFromRow,
  type StudentNotification,
} from "./notifications";
import { getSupabase } from "./supabase";
import { useStudentSession } from "./student-session";

export interface StudentInboxValue {
  messages: InboxMessage[];
  inboxWaiting: number;
  notifications: StudentNotification[];
  unreadCount: number;
  markAllRead: () => Promise<void>;
  markNotificationsRead: (ids?: string[]) => Promise<void>;
}

const StudentInboxContext = createContext<StudentInboxValue | null>(null);

function useStudentInboxState(): StudentInboxValue {
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
        const nextMessages = Array.isArray(inbox.data) ? inbox.data.filter(Boolean) : [];
        const nextNotes = asNotificationList(notes.data);
        setMessages(nextMessages);
        setNotifications(nextNotes);
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

  const inboxWaiting = (Array.isArray(messages) ? messages : []).filter((item) => item.from === "coach" && !item.read).length;
  const unreadCount = items.filter((item) => !item.read).length;

  const markNotificationsRead = useCallback(async (ids?: string[]) => {
    setNotifications((current) =>
      asNotificationList(current).map((item) => {
        if (item.read) return item;
        if (ids && !ids.includes(item.id)) return item;
        return { ...item, read: true };
      })
    );
    try {
      await markOwnNotificationsRead(ids);
    } catch {
      /* Keep the local read state even if a table or column is missing. */
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    setMessages((current) => current.map((item) => (item.read ? item : { ...item, read: true, readAt: now })));
    try {
      await Promise.all([markOwnInboxRead(), markNotificationsRead()]);
    } catch {
      /* Keep the local read state even if a table or column is missing. */
    }
  }, [markNotificationsRead]);

  return {
    messages: Array.isArray(messages) ? messages : [],
    inboxWaiting,
    notifications: items,
    unreadCount,
    markAllRead,
    markNotificationsRead,
  };
}

export function StudentInboxProvider({ children }: { children: ReactNode }) {
  const value = useStudentInboxState();
  return createElement(StudentInboxContext.Provider, { value }, children);
}

export function useStudentInbox(): StudentInboxValue {
  const context = useContext(StudentInboxContext);
  if (!context) {
    throw new Error("useStudentInbox must be used within StudentInboxProvider");
  }
  return context;
}
