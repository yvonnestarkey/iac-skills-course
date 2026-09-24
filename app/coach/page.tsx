"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function CoachHomePage() {
  const { data, setCoach } = useStore();
  const router = useRouter();

  return (
    <div className="coach-page">
      <section className="card login">
        <h1 className="brand">Coach home</h1>
        <p className="muted">
          {data.className} · {data.term}
        </p>
        <h3 style={{ marginTop: 22 }}>Where do you want to go?</h3>
        <div className="people hub-choices">
          <button onClick={() => router.push("/coach/waitlist")}>
            <strong>Waitlist</strong>
            <span className="muted">See who is waiting, then send one free-preview invitation at a time</span>
          </button>
          <button onClick={() => router.push("/coach/students/new")}>
            <strong>Add Student</strong>
            <span className="muted">Invite someone to free preview or complimentary full access</span>
          </button>
          <button onClick={() => router.push("/coach/surveys")}>
            <strong>Custom surveys</strong>
            <span className="muted">Build forms, collect answers, and export CSV</span>
          </button>
          <button onClick={() => router.push("/coach/lists")}>
            <strong>Student lists</strong>
            <span className="muted">Assignments, surveys, roster, and BMCR analytics</span>
          </button>
          <button
            onClick={() => {
              setCoach({ tab: "bmcr" });
              router.push("/coach/lists");
            }}
          >
            <strong>BMCR Analytics</strong>
            <span className="muted">Cohort conversion, diagnostic tiers, and task comparison</span>
          </button>
          <button onClick={() => router.push("/coach/preview")}>
            <strong>Course preview</strong>
            <span className="muted">See the student course with every lesson unlocked</span>
          </button>
          <button onClick={() => router.push("/coach/commerce")}>
            <strong>Payments & referrals</strong>
            <span className="muted">Entitlement, Stripe status, and credits needing manual action</span>
          </button>
          <button onClick={() => router.push("/coach/inbox")}>
            <strong>Inbox</strong>
            <span className="muted">Student questions and assignment feedback</span>
          </button>
          <button onClick={() => router.push("/coach/builder")}>
            <strong>Course creator</strong>
            <span className="muted">Add lessons and import CSV content</span>
          </button>
        </div>
      </section>
    </div>
  );
}
