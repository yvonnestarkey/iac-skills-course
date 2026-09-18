import type { Metadata } from "next";
import { Suspense } from "react";
import BuriedTreasureTool from "@/components/BuriedTreasureTool";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Buried Treasure · IAC Skills Course",
};

export default function StudentBuriedTreasurePage() {
  return (
    <Suspense fallback={<article className="lesson-body wide eval-page"><p className="muted">Loading Buried Treasure…</p></article>}>
      <BuriedTreasureTool />
    </Suspense>
  );
}
