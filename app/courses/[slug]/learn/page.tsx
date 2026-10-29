import type { Metadata } from "next";
import GenericCourseHome from "@/components/student/GenericCourseHome";
import { getLmsCourse } from "@/lib/lms-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = getLmsCourse(slug);
  return { title: course ? `${course.title} · Classroom` : "Classroom" };
}

export default function CourseClassroomPage() {
  return <GenericCourseHome />;
}
