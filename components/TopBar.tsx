"use client";

import { useRouter } from "next/navigation";
import { DEFAULT_LESSON_ID } from "@/lib/constants";
import { waitingQuestions } from "@/lib/course";
import { planStatus } from "@/lib/planner";
import { useStore } from "@/lib/store";

export default function TopBar() {
  const { data, session, setSession, setNotice, setBehindOpen, setPlannerAdjust } = useStore();
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
    setSession({ role: "student", id: value });
    const student = data.students.find((s) => s.id === value);
    const status = student ? planStatus(data, student) : null;
    setBehindOpen(Boolean(status && status.overdue.length));
    router.push(`/learn/${DEFAULT_LESSON_ID}`);
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
            value={session && session.role === "coach" ? "coach" : session ? session.id : "coach"}
            onChange={(event) => switchRole(event.target.value)}
          >
            {data.students.map((s) => (
              <option key={s.id} value={s.id}>
                Student · {s.name}
              </option>
            ))}
            <option value="coach">Coach · Yvonne</option>
          </select>
        </label>
      </div>
    </header>
  );
}
