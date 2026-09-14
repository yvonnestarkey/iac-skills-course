import type { Metadata } from "next";
import StudentOverview from "@/components/student/StudentOverview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Course overview · Coach preview",
};

export default function CoachPreviewOverviewPage() {
  return <StudentOverview />;
}
