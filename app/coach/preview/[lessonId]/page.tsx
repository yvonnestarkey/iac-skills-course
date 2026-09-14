import { connection } from "next/server";
import LessonPdfViewer from "@/components/LessonPdfViewer";
import StudentPlayer from "@/components/student/StudentPlayer";
import { fetchStudentLesson } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

/** Same LessonPdfViewer + StudentPlayer as /student/[lessonId]. */

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }) {
  await connection();
  const { lessonId } = await params;
  const lesson = await fetchStudentLesson(lessonId);
  return {
    title: lesson ? `Preview · ${lesson.title}` : "Lesson not found",
  };
}

export default async function CoachPreviewLessonPage({ params }: { params: Promise<{ lessonId: string }> }) {
  await connection();
  const { lessonId } = await params;
  const lesson = await fetchStudentLesson(lessonId);

  if (!lesson) {
    return (
      <article className="lesson-body">
        <p className="kicker">Course preview</p>
        <h1>Lesson not found</h1>
        <p>There is no lesson with id {lessonId}.</p>
      </article>
    );
  }

  return (
    <StudentPlayer lesson={lesson} initialAccess={{ isLocked: false }}>
      <LessonPdfViewer pdfUrl={lesson.pdf_url} lesson={lesson} />
    </StudentPlayer>
  );
}
