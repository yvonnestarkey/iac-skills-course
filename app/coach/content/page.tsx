"use client";

import { useRouter } from "next/navigation";
import ContentManager from "@/components/coach/ContentManager";
import LiveSessionsManager from "@/components/coach/LiveSessionsManager";

export default function CourseCreatorPage() {
  const router = useRouter();

  return (
    <div className="coach-page">
      <button className="back-link" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <p className="kicker">Course builder</p>
      <h1>Course creator</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Course content is open. Other tools stay closed until you need them.
      </p>
      <ContentManager />
      <LiveSessionsManager />
    </div>
  );
}
