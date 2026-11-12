"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const SIDEBAR_COLLAPSED_KEY = "iac-sidebar-collapsed";

interface StudentNav {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
}

const StudentNavContext = createContext<StudentNav | null>(null);

export function StudentNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1") setCollapsedState(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => setOpen((current) => !current), []);
  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);
  const value = useMemo(
    () => ({ open, setOpen, toggle, collapsed, setCollapsed }),
    [open, toggle, collapsed, setCollapsed]
  );
  return <StudentNavContext.Provider value={value}>{children}</StudentNavContext.Provider>;
}

export function useStudentNav(): StudentNav | null {
  return useContext(StudentNavContext);
}
