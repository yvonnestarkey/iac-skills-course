"use client";

import { useEffect, useState } from "react";
import DrillFlow from "@/components/reading/DrillFlow";
import ReadingCheckFlow from "@/components/reading/ReadingCheckFlow";
import { parseLessonTool, recommend, type DrillExercise } from "@/lib/reading-drills";
import { fetchReadingHistory } from "@/lib/reading-drills-store";
import { useStudentSession } from "@/lib/student-session";

/** The practice tool a lesson shows under its text, chosen in the course builder. Completing it completes the lesson. */
export default function LessonTool({ tool, onComplete }: { tool: string; onComplete: () => void }) {
  const parsed = parseLessonTool(tool);
  const { user } = useStudentSession();
  const [next, setNext] = useState<DrillExercise | null>(null);

  useEffect(() => {
    if (parsed?.kind !== "next") return;
    if (!user?.id) {
      setNext(recommend([]).exercise);
      return;
    }
    fetchReadingHistory(user.id).then((h) => setNext(recommend(h.attempts).exercise));
  }, [parsed?.kind, user?.id]);

  if (!parsed) return null;
  if (parsed.kind === "check") return <ReadingCheckFlow embedded onComplete={onComplete} />;
  if (parsed.kind === "drill") return <DrillFlow key={parsed.exercise.id} exercise={parsed.exercise} embedded onComplete={onComplete} />;
  if (!next) return <p className="muted">Choosing your next exercise…</p>;
  return <DrillFlow key={next.id} exercise={next} embedded onComplete={onComplete} />;
}
