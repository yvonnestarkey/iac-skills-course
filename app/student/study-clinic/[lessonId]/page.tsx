import type { Metadata } from "next";
import StudyClinicLibrary from "@/components/student/StudyClinicLibrary";
import StudyClinicWatch from "@/components/student/StudyClinicWatch";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { fetchStudyClinicClip, studyClinicSectionById } from "@/lib/study-clinic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  const section = studyClinicSectionById(lessonId);
  if (section) return { title: `${section.title} · Study Clinic` };
  const clip = await fetchStudyClinicClip(lessonId);
  return { title: clip ? `${clip.title} · Study Clinic` : "Study Clinic · IAC Skills Course" };
}

export default async function StudentStudyClinicWatchPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const section = studyClinicSectionById(lessonId);
  if (section) return <StudyClinicLibrary section={section} />;
  const user = await getRequestUser();
  const clip = await fetchStudyClinicClip(lessonId, { includeDrafts: isStaffUser(user) });
  if (!clip) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Study Clinic</p>
        <h1>Resource not found</h1>
        <p>That item is not in Study Clinic.</p>
      </article>
    );
  }
  return <StudyClinicWatch clip={clip} />;
}
