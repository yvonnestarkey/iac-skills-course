"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { LMS_COURSES, type LmsCourse } from "./lms-catalog";

const IAC = LMS_COURSES[0];

type LmsCourseContextValue = {
  course: LmsCourse;
  classroomPath: string;
};

const LmsCourseContext = createContext<LmsCourseContextValue>({
  course: IAC,
  classroomPath: "/student",
});

export function LmsCourseProvider({
  course,
  classroomPath,
  children,
}: {
  course: LmsCourse;
  classroomPath: string;
  children: ReactNode;
}) {
  return <LmsCourseContext.Provider value={{ course, classroomPath }}>{children}</LmsCourseContext.Provider>;
}

export function useLmsCourse(): LmsCourseContextValue {
  return useContext(LmsCourseContext);
}
