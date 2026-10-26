import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DrillFlow from "@/components/reading/DrillFlow";
import { getExercise } from "@/lib/reading-drills";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Read the Required · IAC Skills Course",
};

export default async function StudentReadingDrillPage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const exercise = getExercise(exerciseId);
  if (!exercise) notFound();
  return <DrillFlow key={exercise.id} exercise={exercise} />;
}
