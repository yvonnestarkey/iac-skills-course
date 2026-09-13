"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { getSupabase } from "./supabase";
import {
  fetchCompletedLessonIds,
  fetchCourseOutline,
  getStudentUser,
  signOutStudent,
  type OutlineChapter,
  type StudentUser,
} from "./student-lesson";

interface StudentSessionValue {
  ready: boolean;
  user: StudentUser | null;
  outline: OutlineChapter[];
  completed: Record<string, boolean>;
  setLessonCompleted: (lessonId: string, completed: boolean) => void;
  reloadProgress: () => Promise<void>;
  signOut: () => Promise<void>;
}

const StudentSessionContext = createContext<StudentSessionValue | null>(null);

export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StudentUser | null>(null);
  const [outline, setOutline] = useState<OutlineChapter[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});

  const loadProgress = useCallback(async (userId: string) => {
    const ids = await fetchCompletedLessonIds(userId);
    const next: Record<string, boolean> = {};
    ids.forEach((id) => {
      next[id] = true;
    });
    setCompleted(next);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      const [nextUser, nextOutline] = await Promise.all([getStudentUser(), fetchCourseOutline()]);
      if (cancelled) return;
      setUser(nextUser);
      setOutline(nextOutline);
      if (nextUser) await loadProgress(nextUser.id);
      if (!cancelled) setReady(true);
    };

    start();

    const client = getSupabase();
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? { id: session.user.id, email: session.user.email || null } : null;
      setUser(nextUser);
      if (nextUser) {
        loadProgress(nextUser.id);
      } else {
        setCompleted({});
      }
    });

    return () => {
      cancelled = true;
      subscription?.data.subscription.unsubscribe();
    };
  }, [loadProgress]);

  const setLessonCompleted = useCallback((lessonId: string, done: boolean) => {
    setCompleted((current) => ({ ...current, [lessonId]: done }));
  }, []);

  const reloadProgress = useCallback(async () => {
    if (user) await loadProgress(user.id);
  }, [loadProgress, user]);

  const signOut = useCallback(async () => {
    await signOutStudent();
    setUser(null);
    setCompleted({});
  }, []);

  const value = useMemo(
    () => ({ ready, user, outline, completed, setLessonCompleted, reloadProgress, signOut }),
    [ready, user, outline, completed, setLessonCompleted, reloadProgress, signOut]
  );

  return <StudentSessionContext.Provider value={value}>{children}</StudentSessionContext.Provider>;
}

export function useStudentSession(): StudentSessionValue {
  const value = useContext(StudentSessionContext);
  if (!value) throw new Error("useStudentSession must be used inside StudentSessionProvider");
  return value;
}
