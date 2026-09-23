"use client";

import { useMemo } from "react";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { shouldMarkPreviewNav } from "@/lib/preview-nav-state";
import { useStudentSession } from "@/lib/student-session";

export { isPurchaseLockedLesson, shouldMarkPreviewNav } from "@/lib/preview-nav-state";

export function usePreviewNavState() {
  const bypass = useBypassLessonLocks();
  const { entitlement, previewLessonIds } = useStudentSession();
  const previewIdSet = useMemo(() => new Set(previewLessonIds), [previewLessonIds]);

  return {
    markPreviewNav: shouldMarkPreviewNav(entitlement === "free_preview" ? "free_preview" : entitlement === "full" ? "full" : null, bypass),
    previewLessonIds: previewIdSet,
  };
}
