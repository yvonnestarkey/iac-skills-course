"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import TopBar from "@/components/TopBar";
import CoachPreviewShell from "@/components/coach/CoachPreviewShell";
import { CoursePreviewProvider } from "@/lib/course-preview";
import { StudentNavProvider } from "@/lib/student-nav";
import { StudentSessionProvider } from "@/lib/student-session";
import { StudentInboxProvider } from "@/lib/use-student-inbox";
import { useStore } from "@/lib/store";

export default function CoachLayout({ children }: { children: ReactNode }) {
  const { ready, session } = useStore();
  const pathname = usePathname();
  const router = useRouter();
  const isCoach = Boolean(session && session.role === "coach");
  const isPreview = pathname.startsWith("/coach/preview");

  useEffect(() => {
    if (ready && !isCoach) router.replace("/");
  }, [ready, isCoach, router]);

  if (!ready || !isCoach) return null;

  if (isPreview) {
    return (
      <StudentSessionProvider>
        <StudentInboxProvider>
          <CoursePreviewProvider>
            <StudentNavProvider>
              <CoachPreviewShell>{children}</CoachPreviewShell>
            </StudentNavProvider>
          </CoursePreviewProvider>
        </StudentInboxProvider>
      </StudentSessionProvider>
    );
  }

  return (
    <>
      <TopBar />
      <div className="shell coach-shell">{children}</div>
    </>
  );
}
