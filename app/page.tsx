"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { DEFAULT_LESSON_ID } from "@/lib/constants";
import { allLessons, progressFor } from "@/lib/course";
import { planStatus } from "@/lib/planner";
import { useStore } from "@/lib/store";

/** Calendar events exported by the old prototype linked with #lesson=<id>. */
function hashLesson(): string | null {
  if (typeof window === "undefined") return null;
  const match = /lesson=([a-z0-9]+)/i.exec(window.location.hash);
  return match ? match[1] : null;
}

export default function LoginPage() {
  const { ready, data, session, setSession, setBehindOpen, setNotice, reset } = useStore();
  const router = useRouter();

  useEffect(() => {
    if (!ready || !session || session.role !== "student") return;
    const wanted = hashLesson();
    if (wanted && allLessons(data).some((l) => l.id === wanted)) router.replace(`/learn/${wanted}`);
  }, [ready, session, data, router]);

  if (!ready) return null;

  const enterAsStudent = (id: string) => {
    const student = data.students.find((s) => s.id === id);
    setNotice("");
    setSession({ role: "student", id });
    const status = student ? planStatus(data, student) : null;
    if (status && status.overdue.length) setBehindOpen(true);
    const wanted = hashLesson();
    const target = wanted && allLessons(data).some((l) => l.id === wanted) ? wanted : DEFAULT_LESSON_ID;
    router.push(`/learn/${target}`);
  };

  return (
    <section className="card login">
      <h1 className="brand">{data.company}</h1>
      <p className="muted">
        {data.className} · {data.term}
      </p>
      <h3 style={{ marginTop: 22 }}>Enter as a student</h3>
      <div className="people">
        {data.students.map((s) => {
          const p = progressFor(data, s);
          return (
            <button key={s.id} onClick={() => enterAsStudent(s.id)}>
              <strong>{s.name}</strong>
              <span className="muted">
                {p.done}/{p.total} lessons
              </span>
            </button>
          );
        })}
      </div>
      <div className="actions">
        <button
          className="ghost"
          onClick={() => {
            setSession({ role: "coach", id: "coach" });
            router.push("/coach");
          }}
        >
          Coach view
        </button>
        <button className="ghost" onClick={reset}>
          Reset demo data
        </button>
      </div>
    </section>
  );
}
