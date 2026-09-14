import type { ReactNode } from "react";
import StudentShell from "@/components/student/StudentShell";
import { StudentSessionProvider } from "@/lib/student-session";

export default function StudentPlayerLayout({ children }: { children: ReactNode }) {
  return (
    <StudentSessionProvider>
      <StudentShell>{children}</StudentShell>
    </StudentSessionProvider>
  );
}
