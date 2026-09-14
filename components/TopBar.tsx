"use client";

import { usePathname, useRouter } from "next/navigation";
import { Bell, Mail } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import RoleSwitcher from "@/components/RoleSwitcher";
import { unreadForCoach, unreadForStudent } from "@/lib/comms";
import { waitingQuestions } from "@/lib/course";
import { useStore } from "@/lib/store";
import { useStudentNav } from "@/lib/student-nav";
import { useInboxWaiting } from "@/lib/use-inbox-waiting";

export default function TopBar() {
  const { data, session } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const demoWaiting = waitingQuestions(data).length;
  const inboxWaiting = useInboxWaiting();
  const unread =
    session && session.role === "coach"
      ? unreadForCoach(data)
      : session && session.role === "student"
        ? unreadForStudent(data, session.id)
        : 0;
  const isCoach = Boolean(session && session.role === "coach");
  const inboxHref = isCoach ? "/coach/inbox" : "/notifications";
  const notifyHref = isCoach ? "/coach/notifications" : "/notifications";
  const courseNav = useStudentNav();
  const waiting = isCoach ? inboxWaiting + demoWaiting : 0;

  return (
    <header className="topbar">
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
        {waiting ? <span className="pill">{waiting} waiting</span> : null}
        <RoleSwitcher current={isCoach ? "coach" : "students"} />
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
