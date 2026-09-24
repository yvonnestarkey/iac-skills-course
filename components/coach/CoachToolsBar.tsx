"use client";

import { useRouter } from "next/navigation";
import { useStaffCourseView } from "@/lib/staff-course-view";

export default function CoachToolsBar() {
  const router = useRouter();
  const { view, setView } = useStaffCourseView();
  const gatesOn = view === "student_gates";

  return (
    <div className="coach-preview-banner">
      <span>
        <span className="coach-view-pill">{gatesOn ? "Student gates" : "Staff access"}</span>
        <strong>
          {gatesOn
            ? "Student locks are on for this account. Sign in as a real student to test paid progression."
            : "You are using the student course. Every lesson and the Script Evaluator are open for testing."}
        </strong>
      </span>
      <span>
        <button className="ghost" type="button" onClick={() => router.push("/coach")}>
          Coach tools
        </button>
        <button
          className="ghost"
          type="button"
          onClick={() => {
            setView(gatesOn ? "override" : "student_gates");
            router.refresh();
          }}
        >
          {gatesOn ? "Use staff access" : "View student gates"}
        </button>
      </span>
    </div>
  );
}
