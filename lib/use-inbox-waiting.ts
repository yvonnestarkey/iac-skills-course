"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { COACH_ALERTS_EVENT, fetchInboxMessages, unreadStudentThreadCount } from "./inbox";

export function useInboxWaiting(): number {
  const pathname = usePathname();
  const [count, setCount] = useState(0);

  const refresh = useCallback(() => {
    fetchInboxMessages().then((result) => {
      if (!result.ok) return;
      setCount(unreadStudentThreadCount(result.data));
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh, pathname]);

  useEffect(() => {
    const onRefresh = () => refresh();
    window.addEventListener(COACH_ALERTS_EVENT, onRefresh);
    return () => window.removeEventListener(COACH_ALERTS_EVENT, onRefresh);
  }, [refresh]);

  return count;
}
