import type { Metadata } from "next";
import { Suspense } from "react";
import ExamAttemptSubmitted from "@/components/student/ExamAttemptSubmitted";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Attempt submitted · Script evaluator",
};

export default function ExamAttemptSubmittedPage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading…</p></article>}>
      <ExamAttemptSubmitted />
    </Suspense>
  );
}
