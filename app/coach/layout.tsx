"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import TopBar from "@/components/TopBar";
import CoachPreviewShell from "@/components/coach/CoachPreviewShell";
import { CoursePreviewProvider } from "@/lib/course-preview";
import { isCoachAccount } from "@/lib/roles";
import { StudentNavProvider } from "@/lib/student-nav";
import { StudentSessionProvider, useStudentSession } from "@/lib/student-session";
import { StudentInboxProvider } from "@/lib/use-student-inbox";
import { useStore } from "@/lib/store";

export default function CoachLayout({ children }: { children: ReactNode }) {
  return (
    <StudentSessionProvider>
      <CoachLayoutInner>{children}</CoachLayoutInner>
    </StudentSessionProvider>
  );
}

function CoachLayoutInner({ children }: { children: ReactNode }) {
  const { ready: storeReady, session, setSession } = useStore();
  const { ready: authReady, user } = useStudentSession();
  const pathname = usePathname();
  const router = useRouter();
  const isPreview = pathname.startsWith("/coach/preview");
  const isDemoCoach = Boolean(session && session.role === "coach");
  const isAuthCoach = isCoachAccount(user);
  const allowed = process.env.NODE_ENV === "production" ? isAuthCoach : isDemoCoach || isAuthCoach;

  useEffect(() => {
    if (isAuthCoach && !isDemoCoach) setSession({ role: "coach", id: "coach" });
  }, [isAuthCoach, isDemoCoach, setSession]);

  useEffect(() => {
    if (storeReady && authReady && !allowed) router.replace("/login");
  }, [storeReady, authReady, allowed, router]);

  if (!storeReady || !authReady || !allowed) return null;

  if (isPreview) {
    return (
      <StudentInboxProvider>
        <CoursePreviewProvider>
          <StudentNavProvider>
            <CoachPreviewShell>{children}</CoachPreviewShell>
          </StudentNavProvider>
        </CoursePreviewProvider>
      </StudentInboxProvider>
    );
  }

  return (
    <>
      <TopBar />
      <div className="shell coach-shell">{children}</div>
    </>
  );
}
