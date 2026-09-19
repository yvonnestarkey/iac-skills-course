"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { fetchOnboardingGate, clearOnboardingSkipCookie, clearOnboardingGateCache } from "./onboarding";
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
import { fetchOwnSurveyResponses, type CustomSurveyResponse } from "./custom-surveys";
import { fetchStudentSubmissions, type StudentSubmission } from "./student-submissions";

export type OnboardingGate = "unknown" | "needed" | "done";

interface StudentSessionValue {
  ready: boolean;
  user: StudentUser | null;
  outline: OutlineChapter[];
  completed: Record<string, boolean>;
  submissions: Record<string, StudentSubmission>;
  surveyReviews: Record<string, CustomSurveyResponse>;
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
  const [surveyReviews, setSurveyReviews] = useState<Record<string, CustomSurveyResponse>>({});
  const [onboarding, setOnboarding] = useState<OnboardingGate>("unknown");

  const loadProgress = useCallback(async (userId: string) => {
    const [ids, nextSubmissions, nextReviews] = await Promise.all([
      fetchCompletedLessonIds(userId),
      fetchStudentSubmissions(userId),
      fetchOwnSurveyResponses(userId),
    ]);
    const next: Record<string, boolean> = {};
    ids.forEach((id) => {
      next[id] = true;
    });
    setCompleted(next);
    setSubmissions(nextSubmissions);
    setSurveyReviews(nextReviews);
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
          const [, gate] = await Promise.all([loadProgress(nextUser.id), fetchOnboardingGate(nextUser.id)]);
          if (!cancelled) setOnboarding(gate);
        }
      } else {
        setOnboarding("unknown");
      }

      if (!cancelled) setReady(true);
    };

    start();

    const client = getSupabase();
    const subscription = client?.auth.onAuthStateChange((event, session) => {
      // Idle JWT refresh must not re-run the onboarding gate or flash "unknown".
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        if (session?.user) setUser(studentUserFromAuth(session.user));
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        setCompleted({});
        setSubmissions({});
        setSurveyReviews({});
        setOnboarding("unknown");
        clearOnboardingGateCache();
        void clearOnboardingSkipCookie();
        return;
      }

      if (event !== "SIGNED_IN" || !session?.user) return;

      const nextUser = studentUserFromAuth(session.user);
      setUser(nextUser);
      void loadProgress(nextUser.id);
      if (isCoachAccount(nextUser)) {
        setOnboarding("done");
        return;
      }
      fetchOnboardingGate(nextUser.id).then((gate) => {
        setOnboarding((current) => (current === "done" ? "done" : gate));
      });
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
    clearOnboardingGateCache();
    setUser(null);
    setCompleted({});
    setSubmissions({});
    setSurveyReviews({});
    setOnboarding("unknown");
  }, []);

  const value = useMemo(
    () => ({
      ready,
      user,
      outline,
      completed,
      submissions,
      surveyReviews,
      onboarding,
      setLessonCompleted,
      setSubmission,
      reloadProgress,
      signOut,
    }),
    [ready, user, outline, completed, submissions, surveyReviews, onboarding, setLessonCompleted, setSubmission, reloadProgress, signOut]
  );

  return <StudentSessionContext.Provider value={value}>{children}</StudentSessionContext.Provider>;
}

export function useStudentSession(): StudentSessionValue {
  const value = useContext(StudentSessionContext);
  if (!value) throw new Error("useStudentSession must be used inside StudentSessionProvider");
  return value;
}

export function useOptionalStudentSession(): StudentSessionValue | null {
  return useContext(StudentSessionContext);
}
