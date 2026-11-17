"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentInbox } from "@/lib/use-student-inbox";
import { useStudentSession } from "@/lib/student-session";

export default function StudentInboxMarkRead() {
  const router = useRouter();
  const { inboxWaiting, unreadCount, markAllRead } = useStudentInbox();
  const { readOnly } = useStudentSession();

  useEffect(() => {
    if (readOnly) return;
    if (!inboxWaiting && !unreadCount) return;
    let cancelled = false;
    void markAllRead().then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [inboxWaiting, unreadCount, markAllRead, router, readOnly]);

  return null;
}
