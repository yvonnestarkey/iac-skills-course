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
        Tools start closed. Open the one you need.
      </p>
      <ContentManager />
      <LiveSessionsManager />
    </div>
  );
}
