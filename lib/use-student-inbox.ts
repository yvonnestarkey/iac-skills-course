"use client";

import { useEffect, useState } from "react";
import { fetchOwnInboxMessages, fetchOwnNotifications, type InboxMessage } from "./inbox";
import { useStudentSession } from "./student-session";

export function useStudentInbox(): {
  messages: InboxMessage[];
  inboxWaiting: number;
  notifications: InboxMessage[];
} {
  const { user } = useStudentSession();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [notifications, setNotifications] = useState<InboxMessage[]>([]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    Promise.all([fetchOwnInboxMessages(), fetchOwnNotifications()]).then(([inbox, notes]) => {
      if (cancelled) return;
      if (inbox.ok) setMessages(inbox.data);
      if (notes.ok) setNotifications(notes.data);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const last = messages[messages.length - 1];
  const inboxWaiting = last && last.from === "coach" ? 1 : 0;

  return { messages, inboxWaiting, notifications };
}
