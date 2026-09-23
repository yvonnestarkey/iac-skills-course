"use client";

import Link from "next/link";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { shouldShowBuyCourseCta, shouldShowEnrolledAccess } from "@/lib/lesson-availability";
import { useStudentSession } from "@/lib/student-session";

export default function PurchaseCta({ compact = false }: { compact?: boolean }) {
  const bypass = useBypassLessonLocks();
  const { entitlement } = useStudentSession();

  if (bypass || shouldShowEnrolledAccess(entitlement, bypass)) {
    if (compact || bypass) return null;
    return (
      <section className="card">
        <p className="kicker">Full Jan 2027 access</p>
        <h2>You are enrolled in the complete IAC Skills Course</h2>
        <p className="muted">
          You have full course access. Lessons still open in the usual course order. Finish each required step before the next one unlocks.
        </p>
      </section>
    );
  }

  if (!shouldShowBuyCourseCta(entitlement, bypass)) return null;

  if (compact) {
    return (
      <Link className="primary" href="/checkout">
        Buy full course
      </Link>
    );
  }
  return (
    <section className="card">
      <p className="kicker">Full Jan 2027 access</p>
      <h2>Unlock the complete IAC Skills Course</h2>
      <p className="muted">Preview lessons stay free. Paid lessons open after a successful payment on this same account.</p>
      <div className="actions">
        <Link className="primary" href="/checkout">
          Buy full course
        </Link>
      </div>
    </section>
  );
}
