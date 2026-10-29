"use client";

import { useRouter } from "next/navigation";
import { publicCatalogUrl } from "@/lib/lms-hosts";
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
          <button onClick={() => router.push("/coach/account")}>
            <strong>Your profile</strong>
            <span className="muted">Edit your name, email, and phone number</span>
          </button>
          <button onClick={() => router.push("/student")}>
            <strong>Student course</strong>
            <span className="muted">The live student dashboard, lessons, live sessions, and Script Evaluator</span>
          </button>
          <button
            onClick={() => {
              const host = typeof window === "undefined" ? "" : window.location.hostname;
              const local = host === "localhost" || host === "127.0.0.1";
              router.push(local ? "/courses" : publicCatalogUrl());
            }}
          >
            <strong>All courses</strong>
            <span className="muted">Catalog at accountingstudyadvice.com/courses. IAC Skills stays on iac.</span>
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
          <button onClick={() => router.push("/coach/eve-training")}>
            <strong>Eve training data</strong>
            <span className="muted">Your feedback to students, anonymised and paired with their work, ready to train Eve</span>
          </button>
          <button onClick={() => router.push("/coach/drips")}>
            <strong>Drip-feed messages</strong>
            <span className="muted">Automate student notifications after enrolment, on a date, or when they complete a lesson or task</span>
          </button>
          <button onClick={() => router.push("/coach/inbox")}>
            <strong>Inbox</strong>
            <span className="muted">Student questions and assignment feedback</span>
          </button>
          <button onClick={() => router.push("/coach/builder")}>
            <strong>Course creator</strong>
            <span className="muted">Add lessons, live Zoom sessions, and import CSV content</span>
          </button>
          <button onClick={() => router.push("/coach/tools")}>
            <strong>Tools</strong>
            <span className="muted">Edit the Reading & RTFQ Tool and other dashboard tools</span>
          </button>
        </div>
      </section>
    </div>
  );
}
