import type { ReactNode } from "react";
import { StudentSessionProvider } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return <StudentSessionProvider>{children}</StudentSessionProvider>;
}
