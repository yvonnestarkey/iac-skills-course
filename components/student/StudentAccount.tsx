"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import ProfileEditor from "@/components/account/ProfileEditor";
import PurchaseCta from "@/components/commerce/PurchaseCta";
import ReferralCard from "@/components/commerce/ReferralCard";
import DataConsentCard from "@/components/student/DataConsentCard";
import StudentOnboardingDetails from "@/components/student/StudentOnboardingDetails";
import StudentCommitments from "@/components/student/StudentCommitments";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { accountAccessCopy } from "@/lib/account-access";
import { shouldShowBuyCourseCta } from "@/lib/lesson-availability";
import { useStudentSession } from "@/lib/student-session";

export default function StudentAccount() {
  const { user, entitlement, entitlementSource } = useStudentSession();
  const bypass = useBypassLessonLocks();
  const preview = shouldShowBuyCourseCta(entitlement, bypass);
  const accessCopy = accountAccessCopy(entitlement, entitlementSource);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">Account</p>
      <h1>Your account</h1>
      {user?.email ? <p className="muted">{user.email}</p> : null}

      <section className="card">
        <p className="kicker">Profile</p>
        <h2>Your details</h2>
        <p className="muted">Update the name, surname, email, and phone we use for your course account.</p>
        <ProfileEditor />
        <div className="panel-head student-profile-onboarding-toggle">
          <button
            type="button"
            className="activity-progress-toggle"
            aria-expanded={onboardingOpen}
            onClick={() => setOnboardingOpen((open) => !open)}
          >
            <div>
              <h3>Onboarding details</h3>
              <p className="muted small">The answers you gave when you started the course.</p>
            </div>
            <span className="activity-progress-meta">
              {onboardingOpen ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
            </span>
          </button>
        </div>
        {onboardingOpen && user?.id ? <StudentOnboardingDetails userId={user.id} /> : null}
      </section>

      {user?.id ? <StudentCommitments studentId={user.id} /> : null}

      <section className="card">
        <p className="kicker">Course access</p>
        <h2>{accessCopy.title}</h2>
        <p className="muted">{accessCopy.body}</p>
      </section>

      <DataConsentCard mode="account" />

      {preview ? <PurchaseCta compact /> : null}
      <ReferralCard />
    </article>
  );
}
