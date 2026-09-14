import Link from "next/link";
import { connection } from "next/server";
import CoachLessonPreview from "@/components/coach/CoachLessonPreview";
import { fetchStudentLesson } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
      <div className="coach-page">
        <Link className="back-link" href="/coach/preview">
          ← Course preview
        </Link>
        <article className="lesson-body">
          <p className="kicker">Course preview</p>
          <h1>Lesson not found</h1>
          <p>There is no lesson with id {lessonId}.</p>
        </article>
      </div>
    );
  }

  return (
    <div className="coach-page">
      <Link className="back-link" href="/coach/preview">
        ← Course preview
      </Link>
      <CoachLessonPreview lesson={lesson} />
    </div>
  );
}
