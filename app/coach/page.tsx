"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function CoachHomePage() {
  const { data } = useStore();
  const router = useRouter();

  return (
    <div className="coach-page">
      <section className="card login">
        <h1 className="brand">Coach home</h1>
        <p className="muted">
          {data.className} · {data.term}
        </p>
        <h3 style={{ marginTop: 22 }}>Where do you want to go?</h3>
        <div className="people hub-choices">
          <button onClick={() => router.push("/coach/lists")}>
            <strong>Student lists</strong>
            <span className="muted">Assignments, surveys, and the roster</span>
          </button>
          <button onClick={() => router.push("/coach/preview")}>
            <strong>Course preview</strong>
            <span className="muted">Open the full course with every lesson unlocked</span>
          </button>
          <button onClick={() => router.push("/coach/inbox")}>
            <strong>Inbox</strong>
            <span className="muted">Student questions and assignment feedback</span>
          </button>
          <button onClick={() => router.push("/coach/content")}>
            <strong>Course creator</strong>
            <span className="muted">Add lessons and import CSV content</span>
          </button>
        </div>
      </section>
    </div>
  );
}
