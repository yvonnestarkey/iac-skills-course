import { cache } from "react";
import { unstable_cache } from "next/cache";
import type { AccessResult } from "./accessControl";
import { getLessonAccess } from "./lesson-access";
import { getRequestUser, isStaffUser } from "./auth-server";
import { getCourseProduct, resolveLessonContentAccess, stripProtectedLesson } from "./commerce";
import { composeLessonAvailability } from "./lesson-availability";
import { displayLessonType } from "./lesson-type";
import { getLessonPdfUrl } from "./getLessonPdf";
import { protectLessonResourceFields } from "./lesson-assets";
import { fetchCourseOutline, fetchStudentLesson, type StudentLesson } from "./student-lesson";
import type { SubmissionStatus } from "./student-submissions";
import type { LessonType } from "../types/database";

export interface LessonData {
  lesson: StudentLesson | null;
  pdfUrl: string | undefined;
  lessonType: LessonType | undefined;
  isLocked: boolean;
  submissionStatus: SubmissionStatus | null;
  access: AccessResult;
}

const loadCachedOutline = cache(
  unstable_cache(fetchCourseOutline, ["course-outline-v2"], {
    revalidate: 120,
    tags: ["course-outline"],
  })
);

/**
 * Single lesson loader for `/student/[lessonId]` and `/coach/preview/[lessonId]`.
 * Protected body/resources are stripped unless the signed-in account may read them.
 */
export const getLessonData = cache(async (
  lessonId: string,
  options?: { studentId?: string | null; overrideLocks?: boolean }
): Promise<LessonData> => {
  const [user, outline] = await Promise.all([getRequestUser(), loadCachedOutline()]);
  const lesson = await fetchStudentLesson(lessonId, outline);
  if (!lesson) {
    return {
      lesson: null,
      pdfUrl: undefined,
      lessonType: undefined,
      isLocked: false,
      submissionStatus: null,
      access: { isLocked: false },
    };
  }

  const content = await resolveLessonContentAccess(user, lessonId, { overrideLocks: options?.overrideLocks && Boolean(user) });
  const skipProgression = Boolean(options?.overrideLocks && user) || isStaffUser(user);
  const pedagogical =
    user && !skipProgression
      ? await getLessonAccess(user.id, lessonId, { outline, chapterId: lesson.chapterId })
      : { isLocked: false };
  const composed = composeLessonAvailability({
    commercialCanRead: content.canReadBody,
    isPreviewLesson: content.preview,
    pedagogical,
  });
  const protectedLesson = await protectLessonResourceFields(lesson as unknown as Record<string, unknown>, {
    canRead: composed.canReadBody,
    preview: content.preview,
  });
  const visible = composed.canReadBody
    ? ({ ...lesson, ...protectedLesson } as StudentLesson)
    : ({
        ...lesson,
        ...stripProtectedLesson(protectedLesson),
        body: [],
        takeaways: [],
        videos: [],
        video_url: undefined,
        pdf_url: undefined,
        resource_downloads: undefined,
        banner_image_url: null,
        access: composed.layer === "purchase" ? "locked" : lesson.access,
        locked_message: composed.layer === "purchase" ? (await getCourseProduct()).locked_lesson_message : undefined,
      } as StudentLesson);

  const pdfUrl = composed.canReadBody ? getLessonPdfUrl(visible) || (typeof visible.pdf_url === "string" ? visible.pdf_url : undefined) : undefined;
  const lessonType = displayLessonType({ ...visible, pdf_url: pdfUrl });
  const normalized: StudentLesson = { ...visible, pdf_url: pdfUrl, type: lessonType };

  return {
    lesson: normalized,
    pdfUrl,
    lessonType,
    isLocked: composed.access.isLocked,
    submissionStatus: null,
    access: composed.access,
  };
});
