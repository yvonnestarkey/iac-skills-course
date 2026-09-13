"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_ASSIGNMENT_ID } from "./constants";
import { SEED } from "./seed";
import type { CourseData, Student } from "./types";

const STORAGE_KEY = "accounting-study-advice-v1";
const SESSION_KEY = "accounting-study-advice-session";

export const MAX_INLINE_BYTES = 3_000_000;

/** Object URLs for PDFs too large to keep in localStorage. Tab-lifetime only. */
export const sessionFiles: Record<string, string> = {};

export interface Session {
  role: "student" | "coach";
  id: string;
}

function loadData(): CourseData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(SEED);
    const parsed = JSON.parse(raw);
    if (!parsed.chapters) return structuredClone(SEED);
    parsed.chats = parsed.chats || {};
    return parsed;
  } catch {
    return structuredClone(SEED);
  }
}

function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Dashboard filters live in the store so they survive a trip into a profile. */
export interface CoachUi {
  cohort: string;
  tab: "assignments" | "surveys" | "roster";
  filter: "all" | "missing" | "questions" | "submitted";
  assignmentId: string;
}

interface StoreValue {
  ready: boolean;
  data: CourseData;
  session: Session | null;
  student: Student | null;
  notice: string;
  behindOpen: boolean;
  chatOpen: boolean;
  plannerAdjust: boolean;
  coach: CoachUi;
  setCoach: (next: Partial<CoachUi>) => void;
  /** Mutate a draft copy of the course data. Returns false when it would not fit in localStorage. */
  mutate: (fn: (draft: CourseData) => void) => boolean;
  setSession: (session: Session | null) => void;
  setNotice: (notice: string) => void;
  setBehindOpen: (open: boolean) => void;
  setChatOpen: (open: boolean) => void;
  setPlannerAdjust: (open: boolean) => void;
  reset: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<CourseData>(SEED);
  const [session, setSessionState] = useState<Session | null>(null);
  const [notice, setNotice] = useState("");
  const [behindOpen, setBehindOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [plannerAdjust, setPlannerAdjust] = useState(false);
  const [coach, setCoachState] = useState<CoachUi>({
    cohort: "autumn26",
    tab: "assignments",
    filter: "all",
    assignmentId: DEFAULT_ASSIGNMENT_ID,
  });
  const dataRef = useRef<CourseData>(SEED);

  const setCoach = useCallback((next: Partial<CoachUi>) => {
    setCoachState((current) => ({ ...current, ...next }));
  }, []);

  // localStorage is only readable after mount, so hydrate on the client.
  useEffect(() => {
    const loaded = loadData();
    dataRef.current = loaded;
    setData(loaded);
    setSessionState(loadSession());
    setReady(true);
  }, []);

  const mutate = useCallback((fn: (draft: CourseData) => void) => {
    const next = structuredClone(dataRef.current);
    fn(next);
    dataRef.current = next;
    let persisted = true;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      persisted = false;
    }
    setData(next);
    return persisted;
  }, []);

  const setSession = useCallback((next: Session | null) => {
    setSessionState(next);
    try {
      if (next) localStorage.setItem(SESSION_KEY, JSON.stringify(next));
      else localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  const reset = useCallback(() => {
    const fresh = structuredClone(SEED);
    dataRef.current = fresh;
    setData(fresh);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
  }, []);

  const student =
    session && session.role === "student" ? data.students.find((s) => s.id === session.id) || null : null;

  const value: StoreValue = {
    ready,
    data,
    session,
    student,
    notice,
    behindOpen,
    chatOpen,
    plannerAdjust,
    coach,
    setCoach,
    mutate,
    setSession,
    setNotice,
    setBehindOpen,
    setChatOpen,
    setPlannerAdjust,
    reset,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useStore must be used inside <StoreProvider>");
  return value;
}

export function fileHref(studentId: string, lessonId: string, file: { dataUrl?: string }): string {
  if (file.dataUrl) return file.dataUrl;
  return sessionFiles[`${studentId}:${lessonId}`] || "";
}
