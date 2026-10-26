"use client";

import { useMemo } from "react";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { publishedOutline } from "@/lib/lesson-drafts";
import { useStudentSession } from "@/lib/student-session";
import type { OutlineChapter } from "@/lib/student-lesson";

/** Course tree for the signed-in view: drafts stay in Coach View only. */
export function useVisibleCourseOutline(): OutlineChapter[] {
  const { outline } = useStudentSession();
  const includeDrafts = useBypassLessonLocks();
  return useMemo(() => (includeDrafts ? outline : publishedOutline(outline || [])), [includeDrafts, outline]);
}
