import type { Metadata } from "next";
import StudentDashboard from "@/components/student/StudentDashboard";

export const metadata: Metadata = {
  title: "Student dashboard · IAC Skills Course",
};

export default function StudentHomePage() {
  return <StudentDashboard />;
}
