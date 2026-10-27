import type { Metadata } from "next";
import StudyClinicWatch from "@/components/student/StudyClinicWatch";
import { getLessonData } from "@/lib/courseData";
import { isStudyClinicVideo } from "@/lib/study-clinic";
import { fetchCourseOutline } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }): Promise<Metadata> {
  const { lessonId } = await params;
  const { lesson } = await getLessonData(lessonId, { skipProgression: true });
  return { title: lesson ? `${lesson.title} · Study Clinic` : "Study Clinic · IAC Skills Course" };
}

export default async function StudentStudyClinicWatchPage({ params }: { params: Promise<{ lessonId: string }> }) {
  const { lessonId } = await params;
  const outline = await fetchCourseOutline();
  if (!isStudyClinicVideo(outline, lessonId)) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Study Clinic</p>
        <h1>Video not found</h1>
        <p>That clip is not in Study Clinic.</p>
      </article>
    );
  }
  const { lesson, access } = await getLessonData(lessonId, { skipProgression: true });
  if (!lesson) {
    return (
      <article className="lesson-body wide">
        <p className="kicker">Study Clinic</p>
        <h1>Video not found</h1>
        <p>That clip is not in Study Clinic.</p>
      </article>
    );
  }
  return <StudyClinicWatch lesson={lesson} purchaseLocked={access.reason === "purchase"} />;
}
