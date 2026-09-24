"use client";

import PurchaseCta from "@/components/commerce/PurchaseCta";
import ReferralCard from "@/components/commerce/ReferralCard";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { accountAccessCopy } from "@/lib/account-access";
import { shouldShowBuyCourseCta } from "@/lib/lesson-availability";
import { useStudentSession } from "@/lib/student-session";

export default function StudentAccount() {
  const { user, entitlement, entitlementSource } = useStudentSession();
  const bypass = useBypassLessonLocks();
  const preview = shouldShowBuyCourseCta(entitlement, bypass);
  const accessCopy = accountAccessCopy(entitlement, entitlementSource);

  return (
    <article className="lesson-body wide student-dash">
      <p className="kicker">Account</p>
      <h1>Your account</h1>
      {user?.email ? <p className="muted">{user.email}</p> : null}

      <section className="card">
        <p className="kicker">Course access</p>
        <h2>{accessCopy.title}</h2>
        <p className="muted">{accessCopy.body}</p>
      </section>

      {preview ? <PurchaseCta compact /> : null}
      <ReferralCard />
    </article>
  );
}
