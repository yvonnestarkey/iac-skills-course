"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Bell, Mail } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import RoleSwitcher from "@/components/RoleSwitcher";
import StudentCourseNav from "@/components/student/StudentCourseNav";
import { isCoachAccount } from "@/lib/roles";
import { useStudentSession } from "@/lib/student-session";
import { useStudentInbox } from "@/lib/use-student-inbox";
import { StudentNavProvider, useStudentNav } from "@/lib/student-nav";

function LoadingFrame({ label }: { label: string }) {
  return (
    <div className="student-player">
      <header className="student-player-bar">
        <BrandMark />
      </header>
      <p className="student-loading">{label}</p>
    </div>
  );
}

function AuthenticatedShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useStudentSession();
  const { inboxWaiting, unreadCount } = useStudentInbox();
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
        <BrandMark />
        <div className="topbar-right flex items-center gap-2 flex-wrap">
          <button
            className={`notify-btn ${pathname.startsWith("/student/inbox") ? "on" : ""}`}
            type="button"
            aria-label="Inbox"
            onClick={() => router.push("/student/inbox")}
          >
            <Mail size={18} aria-hidden="true" />
            {inboxWaiting ? <span className="pill">{inboxWaiting}</span> : null}
          </button>
          <button
            className={`notify-btn ${pathname.startsWith("/student/notifications") ? "on" : ""}`}
            type="button"
            aria-label="Notifications"
            onClick={() => router.push("/student/notifications")}
          >
            <Bell size={18} aria-hidden="true" />
            {unreadCount > 0 ? <span className="notify-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
          </button>
          {user?.email ? <span className="muted small student-email">{user.email}</span> : null}
          {isCoachAccount(user) ? <RoleSwitcher current="students" /> : null}
          <button className="ghost student-signout" type="button" onClick={leave}>
            Sign Out
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
  const { ready, user, onboarding } = useStudentSession();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/student/login";

  useEffect(() => {
    if (!ready) return;
    if (isLogin) {
      if (!user || onboarding === "unknown") return;
      if (isCoachAccount(user) || onboarding === "done") {
        router.replace("/student");
        return;
      }
      router.replace("/onboarding");
      return;
    }
    if (!user) {
      router.replace("/student/login");
      return;
    }
    if (onboarding === "needed") router.replace("/onboarding");
  }, [ready, user, isLogin, onboarding, pathname, router]);

  if (!ready) return <LoadingFrame label="Loading your course…" />;
  if (isLogin) {
    return (
      <div className="student-player">
        <header className="student-player-bar">
          <BrandMark />
          {isCoachAccount(user) ? <RoleSwitcher current="students" /> : null}
        </header>
        {children}
      </div>
    );
  }
  if (!user) return <LoadingFrame label="Taking you to sign in…" />;
  if (onboarding === "unknown" || onboarding === "needed") {
    return <LoadingFrame label="Taking you to setup…" />;
  }

  return (
    <StudentNavProvider>
      <AuthenticatedShell>{children}</AuthenticatedShell>
    </StudentNavProvider>
  );
}

export default function StudentShell({ children }: { children: ReactNode }) {
  return <StudentGate>{children}</StudentGate>;
}
