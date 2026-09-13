"use client";

import { useParams } from "next/navigation";
import StudentProfile from "@/components/coach/StudentProfile";

export default function StudentProfilePage() {
  const params = useParams<{ id: string }>();
  return <StudentProfile studentId={params.id} />;
}
