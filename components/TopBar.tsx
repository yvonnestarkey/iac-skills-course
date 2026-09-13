"use client";

import { useRouter } from "next/navigation";
import { waitingQuestions } from "@/lib/course";
import { useStore } from "@/lib/store";

export default function TopBar() {
  const { data, session, setSession, setNotice, setPlannerAdjust } = useStore();
  const router = useRouter();
  const waiting = waitingQuestions(data).length;

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
