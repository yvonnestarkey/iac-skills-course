import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import BrandMark from "@/components/BrandMark";
import StudentLoginForm from "@/components/student/StudentLoginForm";
import { StudentSessionProvider } from "@/lib/student-session";

export const metadata: Metadata = {
  title: "Student / Coach sign in · IAC Skills Course",
};

export default function LoginPage() {
  return (
    <StudentSessionProvider>
      <header className="topbar">
        <BrandMark href="/" />
        <Link className="ghost" href="/">
          Course waitlist
        </Link>
      </header>
      <Suspense fallback={<p className="student-loading">Loading…</p>}>
        <StudentLoginForm />
      </Suspense>
    </StudentSessionProvider>
  );
}
