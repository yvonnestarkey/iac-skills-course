"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Mail, MessageCircle } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import RoleSwitcher from "@/components/RoleSwitcher";
import AskQuestionDrawer from "@/components/student/AskQuestionDrawer";
import StudentCourseNav from "@/components/student/StudentCourseNav";
import StudentNotifyMenu from "@/components/student/StudentNotifyMenu";
import { isCoachAccount } from "@/lib/roles";
import { goToStudentLogin, safeStudentPath } from "@/lib/student-lesson";
import { useStudentSession } from "@/lib/student-session";
import { useStudentInbox, StudentInboxProvider } from "@/lib/use-student-inbox";
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
  return (
    <StudentInboxProvider>
      <AuthenticatedChrome>{children}</AuthenticatedChrome>
    </StudentInboxProvider>
  );
}

function AuthenticatedChrome({ children }: { children: ReactNode }) {
  const { user, signOut } = useStudentSession();
  const { inboxWaiting, unreadCount, markAllRead, markNotificationsRead } = useStudentInbox();
  const nav = useStudentNav();
  const pathname = usePathname();
  const router = useRouter();
  const closeNav = nav?.setOpen;
  const [askOpen, setAskOpen] = useState(false);

  useEffect(() => {
    closeNav?.(false);
  }, [pathname, closeNav]);

  useEffect(() => {
    const openAsk = () => setAskOpen(true);
    window.addEventListener("open-ask-question", openAsk);
    return () => window.removeEventListener("open-ask-question", openAsk);
  }, []);

  useEffect(() => {
    if (!pathname.startsWith("/student/inbox")) return;
    if (!inboxWaiting && !unreadCount) return;
    let cancelled = false;
    void markAllRead().then(() => {
      if (!cancelled) router.refresh();
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, markAllRead, router, inboxWaiting, unreadCount]);

  useEffect(() => {
    if (!pathname.startsWith("/student/notifications")) return;
    if (!unreadCount) return;
    void markNotificationsRead();
  }, [pathname, unreadCount, markNotificationsRead]);

  const leave = async () => {
    await signOut();
    goToStudentLogin();
  };

  return (
    <div className="student-player">
      {isCoachAccount(user) ? (
        <div className="coach-preview-banner">
          <span>
            <span className="coach-view-pill">Coach Preview Mode</span>
            <strong>You are viewing the student dashboard with a coach account.</strong>
          </span>
          <span>
            <button className="ghost" type="button" onClick={() => router.push("/coach")}>
              Coach dashboard
            </button>
            <button className="primary" type="button" onClick={() => void leave()}>
              Sign in as student
            </button>
          </span>
        </div>
      ) : null}
      <header className="topbar">
        <BrandMark />
        <div className="topbar-right flex items-center gap-2 flex-wrap">
          <button
            className={`notify-btn ${askOpen ? "on" : ""}`}
            type="button"
            aria-label="Ask a question"
            onClick={() => setAskOpen(true)}
          >
            <MessageCircle size={18} aria-hidden="true" />
          </button>
          <button
            className={`notify-btn ${pathname.startsWith("/student/inbox") ? "on" : ""}`}
            type="button"
            aria-label="Inbox"
            onClick={() => router.push("/student/inbox")}
          >
            <Mail size={18} aria-hidden="true" />
            {inboxWaiting ? <span className="pill">{inboxWaiting}</span> : null}
          </button>
          <StudentNotifyMenu />
          {user?.email ? <span className="muted small student-email">{user.email}</span> : null}
          {isCoachAccount(user) ? <RoleSwitcher current="students" /> : null}
          {isCoachAccount(user) ? null : (
            <Link
              href="/student/account"
              className={`ghost student-account-link ${pathname.startsWith("/student/account") ? "on" : ""}`}
            >
              Account
            </Link>
          )}
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
      <AskQuestionDrawer isOpen={askOpen} onClose={() => setAskOpen(false)} />
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
      if (isCoachAccount(user)) return;
      const next = safeStudentPath(new URLSearchParams(window.location.search).get("next"));
      if (onboarding === "done") {
        router.replace(next);
        return;
      }
      router.replace("/onboarding");
      return;
    }
    if (!user) {
      goToStudentLogin();
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
