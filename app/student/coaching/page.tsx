import type { Metadata } from "next";
import StudentCoachingPage from "@/components/student/StudentCoachingPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "1-on-1 Coaching · IAC Skills Course",
};

export default function StudentCoachingRoute() {
  return <StudentCoachingPage />;
}
