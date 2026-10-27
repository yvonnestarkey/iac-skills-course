import StudentPlayer from "@/components/student/StudentPlayer";
import { getLessonData } from "@/lib/courseData";
import { isVarianceBakeryLesson } from "@/lib/variance-bakery";

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
  const { lesson, access, isLocked } = await getLessonData(lessonId, { overrideLocks });

  if (!lesson) {
    return (
      <article className="lesson-body">
        <p className="kicker">Lesson</p>
        <h1>Lesson not found</h1>
        <p>There is no lesson with id {lessonId}.</p>
      </article>
    );
  }

  return (
    <>
      {isVarianceBakeryLesson(lesson) && (!isLocked || overrideLocks) ? (
        <article className="lesson-body">
          <iframe
            className="variance-bakery-frame"
            src="/tools/variance-bakery.html"
            title="Variance Bakery"
            style={{ width: "100%", minHeight: 2400, border: 0, display: "block" }}
          />
        </article>
      ) : null}
      <StudentPlayer lesson={lesson} initialAccess={access} overrideLocks={overrideLocks} />
    </>
  );
}
