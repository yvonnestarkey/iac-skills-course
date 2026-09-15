"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStudentInbox } from "@/lib/use-student-inbox";

export default function StudentInboxMarkRead() {
  const router = useRouter();
  const { inboxWaiting, unreadCount, markAllRead } = useStudentInbox();

  useEffect(() => {
    if (!inboxWaiting && !unreadCount) return;
    let cancelled = false;
    void markAllRead().then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [inboxWaiting, unreadCount, markAllRead, router]);

  return null;
}
