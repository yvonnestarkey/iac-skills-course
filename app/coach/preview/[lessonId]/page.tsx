import StudentLessonPage, { generateStudentLessonMetadata } from "@/components/student/StudentLessonPage";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ lessonId: string }> }) {
  return generateStudentLessonMetadata(params);
}

export default function Page({ params }: { params: Promise<{ lessonId: string }> }) {
  return <StudentLessonPage params={params} overrideLocks={true} />;
}
