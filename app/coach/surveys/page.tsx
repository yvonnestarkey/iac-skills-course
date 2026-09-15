"use client";

import { useRouter } from "next/navigation";
import SurveyManager from "@/components/coach/SurveyManager";

export default function CoachSurveysPage() {
  const router = useRouter();
  return (
    <div className="coach-page">
      <button className="back-link" type="button" onClick={() => router.push("/coach")}>
        ← Coach home
      </button>
      <SurveyManager />
    </div>
  );
}
