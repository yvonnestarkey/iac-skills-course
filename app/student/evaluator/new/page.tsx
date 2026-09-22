import type { Metadata } from "next";
import { Suspense } from "react";
import ExamAttemptNew from "@/components/student/ExamAttemptNew";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "New exam attempt · Script evaluator",
};

export default function NewExamAttemptPage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading…</p></article>}>
      <ExamAttemptNew />
    </Suspense>
  );
}
