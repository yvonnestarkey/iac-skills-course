import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DrillFlow from "@/components/reading/DrillFlow";
import ReadingToolGate from "@/components/reading/ReadingToolGate";
import { fetchPracticeExercise } from "@/lib/reading-practice";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Reading & RTFQ Tool · IAC Skills Course",
};

export default async function StudentReadingDrillPage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const exercise = await fetchPracticeExercise(exerciseId);
  if (!exercise) notFound();
  return (
    <ReadingToolGate>
      <DrillFlow key={exercise.id} exercise={exercise} />
    </ReadingToolGate>
  );
}
