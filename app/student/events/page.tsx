import type { Metadata } from "next";
import StudentLiveSessionsPage from "@/components/student/StudentLiveSessionsPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Live Sessions & Events · IAC Skills Course",
};

export default function StudentEventsPage() {
  return <StudentLiveSessionsPage />;
}
