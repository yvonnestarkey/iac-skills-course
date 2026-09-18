import type { Metadata } from "next";
import StudentDashboard from "@/components/student/StudentDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Student dashboard · IAC Skills Course",
};

export default function StudentDashboardPage() {
  return <StudentDashboard />;
}
