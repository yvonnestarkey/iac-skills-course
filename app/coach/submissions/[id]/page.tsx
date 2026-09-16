"use client";

import { useParams } from "next/navigation";
import SubmissionReview from "@/components/coach/SubmissionReview";

export default function CoachSubmissionPage() {
  const params = useParams<{ id: string }>();
  return <SubmissionReview id={params.id} />;
}
