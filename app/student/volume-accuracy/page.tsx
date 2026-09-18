import type { Metadata } from "next";
import { Suspense } from "react";
import VolumeAccuracyTool from "@/components/student/VolumeAccuracyTool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Volume vs Accuracy · IAC Skills Course",
};

export default function StudentVolumeAccuracyPage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading Volume vs Accuracy…</p></article>}>
      <VolumeAccuracyTool />
    </Suspense>
  );
}
