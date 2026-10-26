"use client";

import { useEffect, useState } from "react";
import DrillFlow from "@/components/reading/DrillFlow";
import ReadingCheckFlow from "@/components/reading/ReadingCheckFlow";
import { parseLessonTool, recommendUnused, type DrillExercise } from "@/lib/reading-drills";
import { fetchReadingHistory } from "@/lib/reading-drills-store";
import { useStudentSession } from "@/lib/student-session";

/** The practice tool a lesson shows under its text, chosen in the course builder. Completing it completes the lesson. */
export default function LessonTool({ tool, onComplete }: { tool: string; onComplete: () => void }) {
  const parsed = parseLessonTool(tool);
  const { user } = useStudentSession();
  const [next, setNext] = useState<DrillExercise | null>(null);
  const [ready, setReady] = useState(parsed?.kind !== "next");

  useEffect(() => {
    if (parsed?.kind !== "next") return;
    if (!user?.id) {
      setNext(recommendUnused([])?.exercise || null);
      setReady(true);
      return;
    }
    fetchReadingHistory(user.id).then((h) => {
      setNext(recommendUnused(h.attempts)?.exercise || null);
      setReady(true);
    });
  }, [parsed?.kind, user?.id]);

  if (!parsed) return null;
  if (parsed.kind === "check") return <ReadingCheckFlow embedded onComplete={onComplete} />;
  if (parsed.kind === "drill") return <DrillFlow key={parsed.exercise.id} exercise={parsed.exercise} embedded onComplete={onComplete} />;
  if (!ready) return <p className="muted">Choosing your next exercise…</p>;
  if (!next) return <p className="muted">You have completed every reading exercise. Message your coach if you need one reset.</p>;
  return <DrillFlow key={next.id} exercise={next} embedded onComplete={onComplete} />;
}
