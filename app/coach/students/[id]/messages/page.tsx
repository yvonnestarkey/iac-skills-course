"use client";

import { useParams } from "next/navigation";
import StudentMessagesPage from "@/components/coach/StudentMessagesPage";

export default function CoachStudentMessagesRoute() {
  const params = useParams<{ id: string }>();
  return <StudentMessagesPage studentId={params.id} />;
}
