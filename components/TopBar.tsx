"use client";

import { usePathname, useRouter } from "next/navigation";
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
      <div className="mark">
        <span className="dot" />
        <div>
          <strong>{data.company}</strong>
          <span className="muted">{data.className}</span>
        </div>
      </div>
      <div className="topbar-right">
        {isCoach ? (
          <button className={`notify-btn ${pathname.startsWith("/coach/inbox") ? "on" : ""}`} onClick={() => router.push(inboxHref)}>
            Inbox
            {inboxWaiting ? <span className="pill">{inboxWaiting}</span> : null}
          </button>
        ) : null}
        {session ? (
          <button className={`notify-btn ${pathname.startsWith(notifyHref) ? "on" : ""}`} onClick={() => router.push(notifyHref)}>
            Notifications
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
