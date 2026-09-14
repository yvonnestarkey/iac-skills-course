import { connection } from "next/server";
import StudentPlayer from "@/components/student/StudentPlayer";
import { fetchStudentLesson } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

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
  const lesson = await fetchStudentLesson(lessonId);

  if (!lesson) {
    return (
      <article className="lesson-body">
        <p className="kicker">Lesson</p>
        <h1>Lesson not found</h1>
        <p>There is no lesson with id {lessonId}.</p>
      </article>
    );
  }

  return <StudentPlayer lesson={lesson} />;
}
