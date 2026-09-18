import type { Metadata } from "next";
import { Suspense } from "react";
import BmcrDiagnosticTool from "@/components/student/BmcrDiagnosticTool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "BMCR · IAC Skills Course",
};

export default function StudentBmcrPage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading BMCR…</p></article>}>
      <BmcrDiagnosticTool />
    </Suspense>
  );
}
