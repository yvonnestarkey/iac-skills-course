import type { Metadata } from "next";
import StudentAccount from "@/components/student/StudentAccount";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Account · IAC Skills Course",
};

export default function StudentAccountPage() {
  return <StudentAccount />;
}
