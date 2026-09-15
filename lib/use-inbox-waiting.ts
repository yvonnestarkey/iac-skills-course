"use client";

import { useEffect, useState } from "react";
import { fetchInboxMessages, groupInboxByStudent } from "./inbox";

export function useInboxWaiting(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchInboxMessages().then((result) => {
      if (cancelled || !result.ok) return;
      setCount(groupInboxByStudent(result.data).filter((thread) => thread.queued).length);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return count;
}
