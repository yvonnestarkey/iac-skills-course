"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

interface StudentNav {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
}

const StudentNavContext = createContext<StudentNav | null>(null);

export function StudentNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((current) => !current), []);
  const value = useMemo(() => ({ open, setOpen, toggle }), [open, toggle]);
  return <StudentNavContext.Provider value={value}>{children}</StudentNavContext.Provider>;
}

export function useStudentNav(): StudentNav | null {
  return useContext(StudentNavContext);
}
