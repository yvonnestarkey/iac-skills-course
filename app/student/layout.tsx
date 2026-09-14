import type { ReactNode } from "react";
import StudentShell from "@/components/student/StudentShell";
import { StudentSessionProvider } from "@/lib/student-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export default function StudentPlayerLayout({ children }: { children: ReactNode }) {
  return (
    <StudentSessionProvider>
      <StudentShell>{children}</StudentShell>
    </StudentSessionProvider>
  );
}
