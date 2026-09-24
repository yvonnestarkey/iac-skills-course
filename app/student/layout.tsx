import type { ReactNode } from "react";
import StudentShell from "@/components/student/StudentShell";
import { StaffCourseViewProvider } from "@/lib/staff-course-view";
import { StudentSessionProvider } from "@/lib/student-session";

/** StudentShell sends incomplete profiles to /onboarding unless this browser session skipped. */

export default function StudentPlayerLayout({ children }: { children: ReactNode }) {
  return (
    <StudentSessionProvider>
      <StaffCourseViewProvider>
        <StudentShell>{children}</StudentShell>
      </StaffCourseViewProvider>
    </StudentSessionProvider>
  );
}
