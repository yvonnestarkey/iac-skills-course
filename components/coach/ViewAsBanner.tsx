"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { exitViewAsStudent, viewAsDisplayName } from "@/lib/view-as-student";
import { studentProfilePath } from "@/lib/student-profile-link";
import { useStudentSession } from "@/lib/student-session";

export default function ViewAsBanner() {
  const { viewAsStudent, readOnly } = useStudentSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (!readOnly || !viewAsStudent) return null;

  const name = viewAsDisplayName(viewAsStudent);

  const leave = async (href: string) => {
    setBusy(true);
    await exitViewAsStudent();
    window.location.assign(href);
  };

  return (
    <div className="coach-preview-banner view-as-banner">
      <span>
        <span className="coach-view-pill">Read only</span>
        <strong>Viewing as {name}</strong>
        <span className="view-as-banner-note">You can look around. Nothing you click will change their work.</span>
      </span>
      <span className="view-as-banner-actions">
        <button
          className="ghost"
          type="button"
          disabled={busy}
          onClick={() => router.push("/student/dashboard")}
        >
          Student dashboard
        </button>
        <button
          className="primary"
          type="button"
          disabled={busy}
          onClick={() => void leave(studentProfilePath(viewAsStudent.id))}
        >
          {busy ? "Leaving…" : "Exit to profile"}
        </button>
      </span>
    </div>
  );
}
