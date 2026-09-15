"use client";

import { useParams } from "next/navigation";
import SurveyResultsView from "@/components/coach/SurveyResultsView";

export default function CoachSurveyResultsPage() {
  const params = useParams<{ id: string }>();
  return <SurveyResultsView surveyId={params.id} />;
}
