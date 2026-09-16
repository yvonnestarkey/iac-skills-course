"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, LogOut, Mail } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { unreadForCoach } from "@/lib/comms";
import { useStore } from "@/lib/store";
import { useStudentNav } from "@/lib/student-nav";
import { signOutStudent } from "@/lib/student-lesson";
import { useInboxWaiting } from "@/lib/use-inbox-waiting";

export default function TopBar() {
  const { data, session, setSession } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const inboxWaiting = useInboxWaiting();
  const unread = session && session.role === "coach" ? unreadForCoach(data) : 0;
  const isCoach = Boolean(session && session.role === "coach");
  const inboxHref = "/coach/inbox";
  const notifyHref = "/coach/notifications";
  const courseNav = useStudentNav();

  const signOut = async () => {
    await signOutStudent();
    setSession(null);
    router.replace("/");
  };

  return (
    <header className={`topbar ${isCoach ? "coach-topbar" : ""}`}>
      <BrandMark href={isCoach ? "/coach" : "/"} />
      <div className="topbar-right flex items-center gap-2 flex-wrap">
        {isCoach ? (
          <button
            className={`notify-btn ${pathname.startsWith("/coach/inbox") ? "on" : ""}`}
            type="button"
            aria-label="Inbox"
            onClick={() => router.push(inboxHref)}
          >
            <Mail size={18} aria-hidden="true" />
            {inboxWaiting ? <span className="pill">{inboxWaiting}</span> : null}
          </button>
        ) : null}
        {session ? (
          <button
            className={`notify-btn ${pathname.startsWith(notifyHref) ? "on" : ""}`}
            type="button"
            aria-label="Notifications"
            onClick={() => router.push(notifyHref)}
          >
            <Bell size={18} aria-hidden="true" />
            {unread ? <span className="pill">{unread}</span> : null}
          </button>
        ) : null}
        {isCoach ? <span className="coach-view-pill">Coach View</span> : null}
        {isCoach ? (
          <button className="coach-signout" type="button" onClick={() => void signOut()}>
            <LogOut size={16} aria-hidden="true" />
            Sign Out
          </button>
        ) : null}
        {courseNav ? (
          <button
            className={`course-menu-btn ${courseNav.open ? "on" : ""}`}
            aria-expanded={courseNav.open}
            aria-controls="course-nav"
            onClick={courseNav.toggle}
          >
            {courseNav.open ? "Close" : "Course"}
          </button>
        ) : null}
      </div>
    </header>
  );
}
