"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import StudentCourseNav from "@/components/student/StudentCourseNav";
import { safeStudentPath } from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";
import { StudentNavProvider, useStudentNav } from "@/lib/student-nav";

function Brand() {
  return (
    <Link href="/student" className="student-player-brand">
      <span className="dot" aria-hidden="true" />
      <span>
        <strong>Accounting Study Advice</strong>
        <em>IAC Skills Course</em>
      </span>
    </Link>
  );
}

function LoadingFrame({ label }: { label: string }) {
  return (
    <div className="student-player">
      <header className="student-player-bar">
        <Brand />
      </header>
      <p className="student-loading">{label}</p>
    </div>
  );
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useStudentSession();
  const nav = useStudentNav();
  const pathname = usePathname();
  const router = useRouter();
  const closeNav = nav?.setOpen;

  useEffect(() => {
    closeNav?.(false);
  }, [pathname, closeNav]);

  const leave = async () => {
    await signOut();
    router.replace("/student/login");
  };

  return (
    <div className="student-player">
      <header className="topbar">
        <Brand />
        <div className="topbar-right">
          {user?.email ? <span className="muted small student-email">{user.email}</span> : null}
          <button className="ghost student-signout" type="button" onClick={leave}>
            Sign out
          </button>
          {nav ? (
            <button
              className={`course-menu-btn ${nav.open ? "on" : ""}`}
              aria-expanded={nav.open}
              aria-controls="student-course-nav"
              type="button"
              onClick={nav.toggle}
            >
              {nav.open ? "Close" : "Course"}
            </button>
          ) : null}
        </div>
      </header>
      <div className="shell">
        {nav?.open ? (
          <button className="nav-backdrop" aria-label="Close course menu" type="button" onClick={() => nav.setOpen(false)} />
        ) : null}
        <aside id="student-course-nav" className={`sidebar ${nav?.open ? "nav-open" : ""}`}>
          <StudentCourseNav />
        </aside>
        <main className="main">{children}</main>
      </div>
    </div>
  );
}

function StudentGate({ children }: { children: ReactNode }) {
  const { ready, user } = useStudentSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isLogin = pathname === "/student/login";

  useEffect(() => {
    if (!ready) return;
    if (isLogin) {
      if (user) router.replace(safeStudentPath(searchParams.get("next")));
      return;
    }
    if (!user) {
      const next = encodeURIComponent(pathname || "/student");
      router.replace(`/student/login?next=${next}`);
    }
  }, [ready, user, isLogin, pathname, router, searchParams]);

  if (!ready) return <LoadingFrame label="Loading your course…" />;
  if (isLogin) {
    return (
      <div className="student-player">
        <header className="student-player-bar">
          <Brand />
        </header>
        {children}
      </div>
    );
  }
  if (!user) return <LoadingFrame label="Taking you to sign in…" />;

  return (
    <StudentNavProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </StudentNavProvider>
  );
}

export default function StudentShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<LoadingFrame label="Loading your course…" />}>
      <StudentGate>{children}</StudentGate>
    </Suspense>
  );
}
