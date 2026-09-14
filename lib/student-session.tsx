"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchOnboardingState, isOnboardingRequired, clearOnboardingSkipCookie } from "./onboarding";
import { ensureStudentProfile } from "./profiles";
import { isCoachAccount } from "./roles";
import { getSupabase } from "./supabase";
import {
  fetchCompletedLessonIds,
  fetchCourseOutline,
  getStudentUser,
  signOutStudent,
  studentUserFromAuth,
  type OutlineChapter,
  type StudentUser,
} from "./student-lesson";
import { fetchStudentSubmissions, type StudentSubmission } from "./student-submissions";

export type OnboardingGate = "unknown" | "needed" | "done";

interface StudentSessionValue {
  ready: boolean;
  user: StudentUser | null;
  outline: OutlineChapter[];
  completed: Record<string, boolean>;
  submissions: Record<string, StudentSubmission>;
  onboarding: OnboardingGate;
  setLessonCompleted: (lessonId: string, completed: boolean) => void;
  setSubmission: (lessonId: string, submission: StudentSubmission) => void;
  reloadProgress: () => Promise<void>;
  signOut: () => Promise<void>;
}

const StudentSessionContext = createContext<StudentSessionValue | null>(null);

export function StudentSessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StudentUser | null>(null);
  const [outline, setOutline] = useState<OutlineChapter[]>([]);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [submissions, setSubmissions] = useState<Record<string, StudentSubmission>>({});
  const [onboarding, setOnboarding] = useState<OnboardingGate>("unknown");

  const loadProgress = useCallback(async (userId: string) => {
    const [ids, nextSubmissions] = await Promise.all([fetchCompletedLessonIds(userId), fetchStudentSubmissions(userId)]);
    const next: Record<string, boolean> = {};
    ids.forEach((id) => {
      next[id] = true;
    });
    setCompleted(next);
    setSubmissions(nextSubmissions);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      const [nextUser, nextOutline] = await Promise.all([getStudentUser(), fetchCourseOutline()]);
      if (cancelled) return;
      setUser(nextUser);
      setOutline(nextOutline);

      if (nextUser) {
        void ensureStudentProfile(nextUser);
        if (isCoachAccount(nextUser)) {
          setOnboarding("done");
          await loadProgress(nextUser.id);
        } else {
          const [, state] = await Promise.all([loadProgress(nextUser.id), fetchOnboardingState(nextUser.id)]);
          if (!cancelled) {
            setOnboarding(isOnboardingRequired(state) ? "needed" : "done");
          }
        }
      } else {
        setOnboarding("done");
      }

      if (!cancelled) setReady(true);
    };

    start();

    const client = getSupabase();
    const subscription = client?.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ? studentUserFromAuth(session.user) : null;
      setUser(nextUser);
      if (nextUser) {
        void loadProgress(nextUser.id);
        if (isCoachAccount(nextUser)) {
          setOnboarding("done");
        } else {
          fetchOnboardingState(nextUser.id).then((state) => {
            setOnboarding(isOnboardingRequired(state) ? "needed" : "done");
          });
        }
      } else {
        setCompleted({});
        setSubmissions({});
        setOnboarding("done");
        void clearOnboardingSkipCookie();
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

  const setSubmission = useCallback((lessonId: string, submission: StudentSubmission) => {
    setSubmissions((current) => ({ ...current, [lessonId]: submission }));
  }, []);

  const reloadProgress = useCallback(async () => {
    if (user) await loadProgress(user.id);
  }, [loadProgress, user]);

  const signOut = useCallback(async () => {
    await signOutStudent();
    await clearOnboardingSkipCookie();
    setUser(null);
    setCompleted({});
    setSubmissions({});
    setOnboarding("done");
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      outline,
      completed,
      submissions,
      onboarding,
      setLessonCompleted,
      setSubmission,
      reloadProgress,
      signOut,
    }),
    [ready, user, outline, completed, submissions, onboarding, setLessonCompleted, setSubmission, reloadProgress, signOut]
  );

  return <StudentSessionContext.Provider value={value}>{children}</StudentSessionContext.Provider>;
}

export function useStudentSession(): StudentSessionValue {
  const value = useContext(StudentSessionContext);
  if (!value) throw new Error("useStudentSession must be used inside StudentSessionProvider");
  return value;
}
