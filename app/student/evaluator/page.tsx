import type { Metadata } from "next";
import { Suspense } from "react";
import ScriptEvaluatorHub from "@/components/student/ScriptEvaluatorHub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Script evaluator · IAC Skills Course",
};

export default function StudentEvaluatorPage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading script evaluator…</p></article>}>
      <ScriptEvaluatorHub />
    </Suspense>
  );
}
