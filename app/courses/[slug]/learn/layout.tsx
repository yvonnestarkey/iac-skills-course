import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import StudentShell from "@/components/student/StudentShell";
import { CourseBasePathProvider } from "@/lib/course-preview";
import { LmsCourseProvider } from "@/lib/lms-course-context";
import { canonicalCourseSlug, courseClassroomPath, DEFAULT_LMS_COURSE_ID, getLmsCourse } from "@/lib/lms-catalog";
import { currentLmsFront } from "@/lib/lms-front";
import { StaffCourseViewProvider } from "@/lib/staff-course-view";
import { StudentSessionProvider } from "@/lib/student-session";

export default async function CourseClassroomLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = getLmsCourse(slug);
  if (!course) notFound();
  const canonical = canonicalCourseSlug(slug);
  if (canonical && canonical !== course.slug) redirect(`/courses/${canonical}/learn`);
  if (course.id === DEFAULT_LMS_COURSE_ID) {
    const front = await currentLmsFront();
    redirect(courseClassroomPath(course, front));
  }
  const front = await currentLmsFront();
  const classroomPath = courseClassroomPath(course, front);
  return (
    <StudentSessionProvider courseId={course.id}>
      <StaffCourseViewProvider>
        <LmsCourseProvider course={course} classroomPath={classroomPath}>
          <CourseBasePathProvider basePath={classroomPath}>
            <StudentShell>{children}</StudentShell>
          </CourseBasePathProvider>
        </LmsCourseProvider>
      </StaffCourseViewProvider>
    </StudentSessionProvider>
  );
}
