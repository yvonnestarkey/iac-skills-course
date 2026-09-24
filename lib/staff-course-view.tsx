"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  parseStaffCourseView,
  readStaffCourseViewFromCookieHeader,
  writeStaffCourseViewCookie,
  type StaffCourseView,
} from "@/lib/staff-access";

type StaffCourseViewValue = {
  view: StaffCourseView;
  setView: (view: StaffCourseView) => void;
};

const StaffCourseViewContext = createContext<StaffCourseViewValue>({
  view: "override",
  setView: () => undefined,
});

export function StaffCourseViewProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<StaffCourseView>("override");

  useEffect(() => {
    setViewState(readStaffCourseViewFromCookieHeader(document.cookie));
  }, []);

  const value = useMemo<StaffCourseViewValue>(
    () => ({
      view,
      setView: (next) => {
        document.cookie = writeStaffCourseViewCookie(parseStaffCourseView(next));
        setViewState(parseStaffCourseView(next));
      },
    }),
    [view]
  );

  return <StaffCourseViewContext.Provider value={value}>{children}</StaffCourseViewContext.Provider>;
}

export function useStaffCourseView(): StaffCourseViewValue {
  return useContext(StaffCourseViewContext);
}
