import type { Metadata } from "next";
import { Suspense } from "react";
import ScriptEvaluator from "@/components/student/ScriptEvaluator";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "AI Mark Report Evaluation · IAC Skills Course",
};

export default function StudentEvaluatorReportPage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading AI mark report…</p></article>}>
      <ScriptEvaluator />
    </Suspense>
  );
}
