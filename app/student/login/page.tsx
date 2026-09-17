import type { Metadata } from "next";
import { Suspense } from "react";
import StudentLoginForm from "@/components/student/StudentLoginForm";

export const metadata: Metadata = {
  title: "Student sign in · IAC Skills Course",
};

export default function StudentLoginPage() {
  return (
    <Suspense fallback={<p className="student-loading">Loading…</p>}>
      <StudentLoginForm />
    </Suspense>
  );
}
