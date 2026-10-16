"use client";

import { useParams } from "next/navigation";
import StudentNotificationsPage from "@/components/coach/StudentNotificationsPage";

export default function CoachStudentNotificationsRoute() {
  const params = useParams<{ id: string }>();
  return <StudentNotificationsPage studentId={params.id} />;
}
