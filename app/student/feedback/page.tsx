import type { Metadata } from "next";
import StudentFeedbackHub from "@/components/student/StudentFeedbackHub";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Survey & assignment feedback · IAC Skills Course",
};

export default function StudentFeedbackPage() {
  return <StudentFeedbackHub />;
}
