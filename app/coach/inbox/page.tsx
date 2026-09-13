"use client";

import { useRouter } from "next/navigation";
import CoachInbox from "@/components/coach/CoachInbox";

export default function CoachInboxPage() {
  const router = useRouter();
  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <div className="coach-head">
        <div>
          <h1>Inbox</h1>
          <p className="muted">Questions and assignment notes from the student player.</p>
        </div>
      </div>
      <div className="tabs">
        <button className="tab" type="button" onClick={() => router.push("/coach/lists")}>
          Assignments
        </button>
        <button className="tab" type="button" onClick={() => router.push("/coach/lists")}>
          Module Surveys
        </button>
        <button className="tab" type="button" onClick={() => router.push("/coach/lists")}>
          Student Roster
        </button>
        <button className="tab active" type="button">
          Inbox
        </button>
      </div>
      <CoachInbox />
    </div>
  );
}
