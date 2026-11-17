import type { Metadata } from "next";
import { notFound } from "next/navigation";
import DrillFlow from "@/components/reading/DrillFlow";
import { getLiveExercise } from "@/lib/reading-drills";
import { StudentSessionProvider } from "@/lib/student-session";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ exerciseId: string }> }): Promise<Metadata> {
  const { exerciseId } = await params;
  const ex = getLiveExercise(exerciseId);
  return {
    title: ex ? `${ex.title} · Live session · IAC Skills Course` : "Live session · IAC Skills Course",
    robots: { index: false, follow: false },
  };
}

/**
 * The open live-session link: Yvonne shares /live/<id> in a session and anyone can do the exercise,
 * signed in or not, whatever they have done on the course. Nothing is saved to a student's record.
 * Only exercises listed under "live" in lib/data/reading-drills/config.json open here.
 */
export default async function LiveExercisePage({ params }: { params: Promise<{ exerciseId: string }> }) {
  const { exerciseId } = await params;
  const exercise = getLiveExercise(exerciseId);
  if (!exercise) notFound();
  return (
    <StudentSessionProvider>
      <main className="rd-live">
        <DrillFlow key={exercise.id} exercise={exercise} live />
      </main>
    </StudentSessionProvider>
  );
}
