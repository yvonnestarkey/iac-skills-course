"use client";

import { useRouter } from "next/navigation";
import ReadingPracticeManager from "@/components/coach/ReadingPracticeManager";

export default function ReadingToolEditorPage() {
  const router = useRouter();

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach/tools")}>
        ← Tools
      </button>
      <p className="kicker">Tools</p>
      <h1>Reading & RTFQ Tool</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Edit the question bank. This is separate from adding a course lesson.
      </p>
      <section className="card">
        <ReadingPracticeManager />
      </section>
    </div>
  );
}
