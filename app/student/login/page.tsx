import type { Metadata } from "next";
import StudentLoginForm from "@/components/student/StudentLoginForm";

export const metadata: Metadata = {
  title: "Student sign in · IAC Skills Course",
};

export default function StudentLoginPage() {
  return <StudentLoginForm />;
}
