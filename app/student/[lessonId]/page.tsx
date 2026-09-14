import { connection } from "next/server";
import LessonPdfViewer from "@/components/LessonPdfViewer";
import StudentPlayer from "@/components/student/StudentPlayer";
import { getLessonAccess } from "@/lib/accessControl";
import { fetchStudentLesson, getStudentUser } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Same LessonPdfViewer + StudentPlayer as /coach/preview/[lessonId]. */

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }) {
  await connection();
  const { lessonId } = await params;
  const lesson = await fetchStudentLesson(lessonId);
  return {
    title: lesson ? `${lesson.title} · IAC Skills Course` : "Lesson not found",
  };
}

export default async function StudentLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  await connection();
  const { lessonId } = await params;
  const [lesson, user] = await Promise.all([fetchStudentLesson(lessonId), getStudentUser()]);

  if (!lesson) {
    return (
      <article className="lesson-body">
        <p className="kicker">Lesson</p>
        <h1>Lesson not found</h1>
        <p>There is no lesson with id {lessonId}.</p>
      </article>
    );
  }

  const initialAccess = user ? await getLessonAccess(user.id, lesson.id) : { isLocked: false };

  return (
    <StudentPlayer lesson={lesson} initialAccess={initialAccess}>
      <LessonPdfViewer pdfUrl={lesson.pdf_url} lesson={lesson} />
    </StudentPlayer>
  );
}
