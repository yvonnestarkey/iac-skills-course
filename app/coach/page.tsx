"use client";

import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";

export default function CoachHomePage() {
  const { data, setCoach } = useStore();
  const router = useRouter();

  return (
    <div className="coach-page">
      <section className="card login">
        <h1 className="brand">Coach tools</h1>
        <p className="muted">
          {data.className} · {data.term}
        </p>
        <h3 style={{ marginTop: 22 }}>Where do you want to go?</h3>
        <div className="people hub-choices">
          <button onClick={() => router.push("/student")}>
            <strong>Student course</strong>
            <span className="muted">The live student dashboard, lessons, live sessions, and Script Evaluator</span>
          </button>
          <button onClick={() => router.push("/coach/referrals")}>
            <strong>Referrals</strong>
            <span className="muted">Successful student and professional colleague referrals, including payout records</span>
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
          <button onClick={() => router.push("/coach/commerce")}>
            <strong>Payments & referrals</strong>
            <span className="muted">Entitlement, Stripe status, and credits needing manual action</span>
          </button>
          <button onClick={() => router.push("/coach/revenue")}>
            <strong>Revenue</strong>
            <span className="muted">Monthly sales, instalments, cash, referrals, and student statements</span>
          </button>
          <button onClick={() => router.push("/coach/evaluator")}>
            <strong>Script Evaluator reports</strong>
            <span className="muted">Student submissions on the new evaluator: progress per paper, review and release reports, and the on/off switch</span>
          </button>
          <button onClick={() => router.push("/evaluator-preview")}>
            <strong>Evaluator report preview</strong>
            <span className="muted">Staff only: see saved Script Evaluator runs as the student report, ready to save as PDF. Students cannot see this yet</span>
          </button>
          <button onClick={() => router.push("/coach/inbox")}>
            <strong>Inbox</strong>
            <span className="muted">Student questions and assignment feedback</span>
          </button>
          <button onClick={() => router.push("/coach/builder")}>
            <strong>Course creator</strong>
            <span className="muted">Add lessons, live Zoom sessions, and import CSV content</span>
          </button>
        </div>
      </section>
    </div>
  );
}
