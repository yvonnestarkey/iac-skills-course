"use client";

import { useParams } from "next/navigation";
import StudentSurveysPage from "@/components/coach/StudentSurveysPage";

export default function CoachStudentSurveysRoute() {
  const params = useParams<{ id: string }>();
  return <StudentSurveysPage studentId={params.id} />;
}
