import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import StudentShell from "@/components/student/StudentShell";
import { CourseBasePathProvider } from "@/lib/course-preview";
import { LmsCourseProvider } from "@/lib/lms-course-context";
import { canonicalCourseSlug, courseClassroomHref, DEFAULT_LMS_COURSE_ID, getLmsCourse } from "@/lib/lms-catalog";
import { currentLmsFront } from "@/lib/lms-front";
import { iacClassroomUrl } from "@/lib/lms-hosts";
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
  const front = await currentLmsFront();
  const canonical = canonicalCourseSlug(slug);
  if (canonical && canonical !== course.slug) redirect(courseClassroomHref(course, front));
  if (course.id === DEFAULT_LMS_COURSE_ID) redirect(iacClassroomUrl());
  const classroomPath = courseClassroomHref(course, front);
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
