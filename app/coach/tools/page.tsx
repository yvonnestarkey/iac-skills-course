"use client";

import { useRouter } from "next/navigation";
import { COURSE_TOOLS } from "@/lib/course-tools";

export default function CourseToolsPage() {
  const router = useRouter();

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach/builder")}>
        ← Course creator
      </button>
      <p className="kicker">Course builder</p>
      <h1>Tools</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Edit dashboard tools here. Lessons stay in Course creator.
      </p>
      <div className="people hub-choices">
        {COURSE_TOOLS.map((tool) => (
          <button key={tool.id} type="button" onClick={() => router.push(tool.href)}>
            <strong>{tool.title}</strong>
            <span className="muted">{tool.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
