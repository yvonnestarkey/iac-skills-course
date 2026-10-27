import type { Metadata } from "next";
import StudyClinicWatch from "@/components/student/StudyClinicWatch";
import { fetchStudyClinicClip } from "@/lib/study-clinic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  const clip = await fetchStudyClinicClip(lessonId);
  return { title: clip ? `${clip.title} · Study Clinic` : "Study Clinic · IAC Skills Course" };
}

export default async function StudentStudyClinicWatchPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const clip = await fetchStudyClinicClip(lessonId);
  if (!clip) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Study Clinic</p>
        <h1>Video not found</h1>
        <p>That clip is not in Study Clinic.</p>
      </article>
    );
  }
  return <StudyClinicWatch clip={clip} />;
}
