"use client";

import { usePathname, useRouter } from "next/navigation";
import { chapterCode } from "@/lib/course";
import { longDate } from "@/lib/dates";
import { planStatus } from "@/lib/planner";
import { useStore } from "@/lib/store";

export default function BehindModal() {
  const { ready, data, session, student, behindOpen, setBehindOpen, setNotice, setPlannerAdjust } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  if (pathname.startsWith("/student")) return null;
  if (!ready || !behindOpen || !session || session.role !== "student" || !student) return null;
  const status = planStatus(data, student);
  if (!status || !status.overdue.length) return null;

  const revise = () => {
    setBehindOpen(false);
    setPlannerAdjust(true);
    setNotice("");
    router.push("/planner");
  };

  return (
    <div className="modal-backdrop">
      <section className="modal" role="dialog" aria-label="You are behind your study plan">
        <h2>Welcome back, {student.name.split(" ")[0]}</h2>
        <p>
          You are{" "}
          <strong>
            {status.overdue.length} item{status.overdue.length === 1 ? "" : "s"}
          </strong>{" "}
          behind your study plan. Nothing is lost — you can reschedule it or carry on from where you are.
        </p>
        <ul className="modal-list">
          {status.overdue.slice(0, 4).map((o) => (
            <li key={o.lesson.id}>
              <strong>{o.lesson.title}</strong>
              <span className="muted small">
                {chapterCode(o.lesson.chapter)} · was scheduled {longDate(o.date)}
              </span>
            </li>
          ))}
        </ul>
        {status.overdue.length > 4 ? (
          <p className="muted small">and {status.overdue.length - 4} more.</p>
        ) : null}
        <div className="modal-actions">
          <button className="primary" id="modal-revise" onClick={revise}>
            Revise my plan
          </button>
          <button className="ghost" id="modal-continue" onClick={() => setBehindOpen(false)}>
            Just keep learning
          </button>
        </div>
      </section>
    </div>
  );
}
