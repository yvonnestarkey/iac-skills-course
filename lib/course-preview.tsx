"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { staffOverrideApplies } from "@/lib/staff-access";
import { useStaffCourseView } from "@/lib/staff-course-view";
import { useStudentSession } from "@/lib/student-session";

export const COURSE_PREVIEW_BASE = "/coach/preview";

export interface CoursePreviewValue {
  unlocked: boolean;
  basePath: "/student" | "/learn" | "/coach/preview";
}

const CoursePreviewContext = createContext<CoursePreviewValue>({
  unlocked: false,
  basePath: "/student",
});

export function CoursePreviewProvider({
  children,
  basePath = COURSE_PREVIEW_BASE,
}: {
  children: ReactNode;
  basePath?: CoursePreviewValue["basePath"];
}) {
  return (
    <CoursePreviewContext.Provider value={{ unlocked: true, basePath }}>{children}</CoursePreviewContext.Provider>
  );
}

export function useCoursePreview(): CoursePreviewValue {
  return useContext(CoursePreviewContext);
}

/** Staff override and /coach/preview skip student lesson, section, and phase gates. */
export function useBypassLessonLocks(): boolean {
  const { unlocked } = useCoursePreview();
  const { user } = useStudentSession();
  const { view } = useStaffCourseView();
  return unlocked || staffOverrideApplies(user, view);
}
