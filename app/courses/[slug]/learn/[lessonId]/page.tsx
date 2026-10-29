import StudentLessonPage, { generateStudentLessonMetadata } from "@/components/student/StudentLessonPage";
import { getLmsCourse } from "@/lib/lms-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const course = getLmsCourse(slug);
  const meta = await generateStudentLessonMetadata(Promise.resolve({ lessonId }));
  if (!course) return meta;
  return { title: String(meta.title || "Lesson").replace(/IAC Skills Course/g, course.shortTitle) };
}

export default async function CourseLessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const course = getLmsCourse(slug);
  return <StudentLessonPage params={Promise.resolve({ lessonId })} courseId={course?.id} />;
}
