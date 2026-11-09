"use client";

import { useRouter } from "next/navigation";
import StudyClinicManager from "@/components/coach/StudyClinicManager";

export default function StudyClinicEditorPage() {
  const router = useRouter();

  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach/tools")}>
        ← Tools
      </button>
      <p className="kicker">Tools</p>
      <h1>Study Clinic</h1>
      <p className="muted small" style={{ marginBottom: 16 }}>
        Add videos, PDFs, and links here, or on each student library page. They live in study_clinic, not in Course
        content.
      </p>
      <section className="card">
        <StudyClinicManager />
      </section>
    </div>
  );
}
