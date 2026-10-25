"use client";

import { useParams } from "next/navigation";
import SubmissionReview from "@/components/coach/SubmissionReview";

export default function CoachLessonSubmissionPage() {
  const params = useParams<{ id: string }>();
  return <SubmissionReview id={String(params.id || "")} kind="lesson" />;
}
