"use client";

import PurchaseCta from "@/components/commerce/PurchaseCta";
import ReferralCard from "@/components/commerce/ReferralCard";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { shouldShowBuyCourseCta, shouldShowEnrolledAccess } from "@/lib/lesson-availability";
import { useStudentSession } from "@/lib/student-session";

export default function StudentAccount() {
  const { user, entitlement } = useStudentSession();
  const bypass = useBypassLessonLocks();
  const fullAccess = shouldShowEnrolledAccess(entitlement, bypass);
  const preview = shouldShowBuyCourseCta(entitlement, bypass);

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">Account</p>
      <h1>Your account</h1>
      {user?.email ? <p className="muted">{user.email}</p> : null}

      <section className="card">
        <p className="kicker">Course access</p>
        <h2>{fullAccess ? "Full Jan 2027 access" : preview ? "Free preview" : "Course access"}</h2>
        <p className="muted">
          {fullAccess
            ? "Payment received. You have access to the complete IAC Skills Course on this account."
            : preview
              ? "You can open the designated preview lessons. Unlock the full course to continue on this same account."
              : "Course access is loading."}
        </p>
      </section>

      {preview ? <PurchaseCta compact /> : null}
      <ReferralCard />
    </article>
  );
}
