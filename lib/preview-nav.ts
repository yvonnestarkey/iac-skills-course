"use client";

import { useEffect, useMemo, useState } from "react";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { shouldMarkPreviewNav } from "@/lib/preview-nav-state";
import { useStudentSession } from "@/lib/student-session";

export { isPurchaseLockedLesson, shouldMarkPreviewNav } from "@/lib/preview-nav-state";

export function usePreviewNavState() {
  const bypass = useBypassLessonLocks();
  const { user } = useStudentSession();
  const [entitlement, setEntitlement] = useState<string | null>(null);
  const [previewLessonIds, setPreviewLessonIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user || bypass) {
      setEntitlement(bypass ? "staff" : null);
      setPreviewLessonIds([]);
      return;
    }
    let cancelled = false;
    fetch("/api/student/outline")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setEntitlement(typeof data.entitlement === "string" ? data.entitlement : null);
        setPreviewLessonIds(Array.isArray(data.preview_lesson_ids) ? data.preview_lesson_ids.map(String) : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user, bypass]);

  const previewIdSet = useMemo(() => new Set(previewLessonIds), [previewLessonIds]);

  return {
    markPreviewNav: shouldMarkPreviewNav(entitlement, bypass),
    previewLessonIds: previewIdSet,
  };
}
