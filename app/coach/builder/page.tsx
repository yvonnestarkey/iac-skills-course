"use client";

import { useRouter } from "next/navigation";
import ContentManager from "@/components/coach/ContentManager";
import CourseToolsPanel from "@/components/coach/CourseToolsPanel";
import LiveSessionsManager from "@/components/coach/LiveSessionsManager";

export default function CourseCreatorPage() {
  const router = useRouter();

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <p className="kicker">Course builder</p>
      <h1>Course creator</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Tools are at the top. Lessons and live sessions stay below.
      </p>
      <CourseToolsPanel />
      <ContentManager />
      <LiveSessionsManager />
    </div>
  );
}
