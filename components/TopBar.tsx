"use client";

import { usePathname, useRouter } from "next/navigation";
import { unreadForCoach, unreadForStudent } from "@/lib/comms";
import { waitingQuestions } from "@/lib/course";
import { useStore } from "@/lib/store";

export default function TopBar() {
  const { data, session, setSession, setNotice, setPlannerAdjust } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const waiting = waitingQuestions(data).length;
  const unread =
    session && session.role === "coach"
      ? unreadForCoach(data)
      : session && session.role === "student"
        ? unreadForStudent(data, session.id)
        : 0;
  const inboxHref = session && session.role === "coach" ? "/coach/notifications" : "/notifications";

  const switchRole = (value: string) => {
    setNotice("");
    setPlannerAdjust(false);
    if (value === "coach") {
      setSession({ role: "coach", id: "coach" });
      router.push("/coach");
      return;
    }
    // Students pick themselves on the sign-in page — the list will not fit here.
    setSession(null);
    router.push("/");
  };

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
        {session ? (
          <button
            className={`notify-btn ${pathname.startsWith(inboxHref) ? "on" : ""}`}
            onClick={() => router.push(inboxHref)}
          >
            Notifications
            {unread ? <span className="pill">{unread}</span> : null}
          </button>
        ) : null}
        {session && session.role === "coach" && waiting ? <span className="pill">{waiting} waiting</span> : null}
        <label className="role-chip">
          View as
          <select
            id="role"
            value={session && session.role === "coach" ? "coach" : "students"}
            onChange={(event) => switchRole(event.target.value)}
          >
            <option value="students">Students</option>
            <option value="coach">Coach</option>
          </select>
        </label>
      </div>
    </header>
  );
}
