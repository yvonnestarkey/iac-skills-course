"use client";

import Link from "next/link";
import { useBypassLessonLocks } from "@/lib/course-preview";
import { shouldShowBuyCourseCta } from "@/lib/lesson-availability";
import { useStudentSession } from "@/lib/student-session";

export default function PurchaseCta({ compact = false }: { compact?: boolean }) {
  const bypass = useBypassLessonLocks();
  const { entitlement } = useStudentSession();

  if (!shouldShowBuyCourseCta(entitlement, bypass)) return null;

  if (compact) {
    return (
      <section className="purchase-cta-compact">
        <p>Unlock the rest of the Jan 2027 course on this same account.</p>
        <Link className="primary" href="/checkout">
          Unlock full course
        </Link>
      </section>
    );
  }

  return (
    <section className="card purchase-cta">
      <p className="kicker">Full Jan 2027 access</p>
      <h2>Unlock the complete IAC Skills Course</h2>
      <p className="muted">Preview lessons stay free. Paid lessons open after a successful payment on this same account.</p>
      <div className="actions">
        <Link className="primary" href="/checkout">
          Unlock full course
        </Link>
      </div>
    </section>
  );
}
