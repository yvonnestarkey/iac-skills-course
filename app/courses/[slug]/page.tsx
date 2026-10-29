import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import CourseHome from "@/components/catalog/CourseHome";
import { canonicalCourseSlug, getLmsCourse } from "@/lib/lms-catalog";
import { currentLmsFront } from "@/lib/lms-front";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const course = getLmsCourse(slug);
  return {
    title: course ? `${course.title} · Accounting Study Advice` : "Course · Accounting Study Advice",
  };
}

export default async function CoursePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const course = getLmsCourse(slug);
  if (!course) notFound();
  const canonical = canonicalCourseSlug(slug);
  if (canonical && canonical !== slug) redirect(`/courses/${canonical}`);
  const front = await currentLmsFront();
  return <CourseHome course={course} front={front} />;
}
