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
        Lessons and live sessions stay here. Edit dashboard tools in a separate Tools workspace.
      </p>
      <section className="card" style={{ marginBottom: 16 }}>
        <h2>Tools</h2>
        <p className="muted small">
          Reading & RTFQ and other dashboard tools have their own editor. That is not the same as adding a lesson.
        </p>
        <div className="actions">
          <button className="primary" type="button" onClick={() => router.push("/coach/tools")}>
            Edit tools
          </button>
        </div>
      </section>
      <ContentManager />
      <LiveSessionsManager />
    </div>
  );
}
