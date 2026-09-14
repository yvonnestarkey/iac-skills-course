import StudentLessonPage, { generateStudentLessonMetadata } from "@/components/student/StudentLessonPage";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }) {
  return generateStudentLessonMetadata(params);
}

export default function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  return <StudentLessonPage params={params} />;
}
