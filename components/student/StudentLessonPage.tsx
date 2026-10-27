import StudentPlayer from "@/components/student/StudentPlayer";
import { getLessonData } from "@/lib/courseData";

export async function generateStudentLessonMetadata(params: Promise<{ lessonId: string }>) {
  const { lessonId } = await params;
  const { lesson } = await getLessonData(lessonId);
  return {
    title: lesson ? `${lesson.title} · IAC Skills Course` : "Lesson not found",
  };
}

export default async function StudentLessonPage({
  params,
  overrideLocks = false,
}: {
  params: Promise<{ lessonId: string }>;
  overrideLocks?: boolean;
}) {
  const { lessonId } = await params;
  const { lesson, access } = await getLessonData(lessonId, { overrideLocks });

  if (!lesson) {
    return (
      <article className="lesson-body">
        <p className="kicker">Lesson</p>
        <h1>Lesson not found</h1>
        <p>There is no lesson with id {lessonId}.</p>
      </article>
    );
  }

  return <StudentPlayer lesson={lesson} initialAccess={access} overrideLocks={overrideLocks} />;
}
