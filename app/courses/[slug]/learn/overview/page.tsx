import type { Metadata } from "next";
import StudentOverview from "@/components/student/StudentOverview";
import { getLmsCourse } from "@/lib/lms-catalog";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = getLmsCourse(slug);
  return { title: course ? `Course overview · ${course.title}` : "Course overview" };
}

export default function CourseOverviewPage() {
  return <StudentOverview />;
}
