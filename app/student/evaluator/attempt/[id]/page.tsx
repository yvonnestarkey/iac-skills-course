import type { Metadata } from "next";
import { Suspense } from "react";
import ExamAttemptWorkspace from "@/components/student/ExamAttemptWorkspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Exam attempt · Script evaluator",
};

export default function ExamAttemptPage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading exam attempt…</p></article>}>
      <ExamAttemptWorkspace />
    </Suspense>
  );
}
