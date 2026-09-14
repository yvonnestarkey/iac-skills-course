import type { Metadata } from "next";
import StudentOverview from "@/components/student/StudentOverview";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Course overview · IAC Skills Course",
};

export default function StudentOverviewPage() {
  return <StudentOverview />;
}
