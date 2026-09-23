import { Suspense } from "react";
import StudentLoginForm from "@/components/student/StudentLoginForm";
import { StudentSessionProvider } from "@/lib/student-session";

export default function RegisterPage() {
  return (
    <StudentSessionProvider>
      <Suspense fallback={<p className="student-loading">Loading…</p>}>
        <StudentLoginForm initialMode="signup" />
      </Suspense>
    </StudentSessionProvider>
  );
}
