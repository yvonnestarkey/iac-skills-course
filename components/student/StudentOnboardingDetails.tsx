"use client";

import { useEffect, useState } from "react";
import OnboardingFacts from "@/components/account/OnboardingFacts";
import { fetchOwnOnboardingAnswers } from "@/lib/onboarding";
import type { SurveyQuestionType } from "@/lib/custom-surveys";

export default function StudentOnboardingDetails({ userId }: { userId: string }) {
  const [answers, setAnswers] = useState<{ label: string; value: string; type: SurveyQuestionType }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchOwnOnboardingAnswers(userId).then((rows) => {
      if (cancelled) return;
      setAnswers(rows);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!loaded) return <p className="muted small">Loading onboarding details…</p>;
  return <OnboardingFacts answers={answers} />;
}
