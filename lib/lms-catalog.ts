import { CLASS_LMS_HOST, IAC_LMS_ORIGIN, catalogPath, type LmsFront } from "./lms-hosts";

export const DEFAULT_LMS_COURSE_ID = "iac-skills";

export type LmsCourseStatus = "live" | "import-ready";

export type LmsCourse = {
  id: string;
  slug: string;
  /** Extra public paths on class. that resolve to this course. */
  aliases: string[];
  title: string;
  shortTitle: string;
  status: LmsCourseStatus;
  productId: string | null;
  summary: string;
  thinkificSchool: string;
};

export const LMS_COURSES: LmsCourse[] = [
  {
    id: "iac-skills",
    slug: "iac-skills",
    aliases: [],
    title: "IAC Skills",
    shortTitle: "IAC Skills Course",
    status: "live",
    productId: "jan27-iac",
    summary: "The live January 2027 IAC Skills classroom. Same course students already use on iac.accountingstudyadvice.com.",
    thinkificSchool: "courses.accountingstudyadvice.com",
  },
  {
    id: "cta-skills",
    slug: "cta-skills",
    aliases: [],
    title: "CTA Skills",
    shortTitle: "CTA Skills",
    status: "import-ready",
    productId: null,
    summary: "Classroom ready. Lessons appear here once this Thinkific course is imported — no lesson copy has been added yet.",
    thinkificSchool: "courses.accountingstudyadvice.com",
  },
  {
    id: "controls",
    slug: "controls",
    aliases: ["auditrisk"],
    title: "Controls",
    shortTitle: "Controls",
    status: "import-ready",
    productId: null,
    summary: "Classroom ready. Lessons appear here once this Thinkific course is imported — no lesson copy has been added yet.",
    thinkificSchool: "courses.accountingstudyadvice.com",
  },
  {
    id: "substantive",
    slug: "substantive",
    aliases: [],
    title: "Substantive Procedures",
    shortTitle: "Substantive Procedures",
    status: "import-ready",
    productId: null,
    summary: "Classroom ready. Lessons appear here once this Thinkific course is imported — no lesson copy has been added yet.",
    thinkificSchool: "courses.accountingstudyadvice.com",
  },
  {
    id: "strategy-mindset",
    slug: "strategy-mindset",
    aliases: [],
    title: "Strategy & Mindset",
    shortTitle: "Strategy & Mindset",
    status: "import-ready",
    productId: null,
    summary: "Classroom ready. Lessons appear here once this Thinkific course is imported — no lesson copy has been added yet.",
    thinkificSchool: "courses.accountingstudyadvice.com",
  },
];

const bySlug = new Map<string, LmsCourse>();
for (const course of LMS_COURSES) {
  bySlug.set(course.slug, course);
  bySlug.set(course.id, course);
  for (const alias of course.aliases) bySlug.set(alias, course);
}

export function isDefaultLmsCourse(idOrSlug: string | null | undefined): boolean {
  return (idOrSlug || DEFAULT_LMS_COURSE_ID) === DEFAULT_LMS_COURSE_ID;
}

export function getLmsCourse(slugOrId: string | null | undefined): LmsCourse | null {
  if (!slugOrId) return null;
  return bySlug.get(slugOrId) || null;
}

export function lmsCourseSlugs(): string[] {
  return LMS_COURSES.flatMap((course) => [course.slug, ...course.aliases]);
}

export function isLmsCourseSlug(value: string | null | undefined): boolean {
  return Boolean(value && bySlug.has(value));
}

export function canonicalCourseSlug(slugOrId: string): string | null {
  return getLmsCourse(slugOrId)?.slug ?? null;
}

export function coursePublicPath(course: LmsCourse, front: LmsFront = "class"): string {
  return front === "class" ? `/${course.slug}` : `/courses/${course.slug}`;
}

export function courseClassroomPath(course: LmsCourse, front: LmsFront = "class"): string {
  if (course.id === DEFAULT_LMS_COURSE_ID) {
    return front === "class" ? "/iac-skills/learn" : "/student";
  }
  return front === "class" ? `/${course.slug}/learn` : `/courses/${course.slug}/learn`;
}

export function iacClassroomUrl(): string {
  return `${IAC_LMS_ORIGIN}/student`;
}

export function classCourseUrl(course: LmsCourse): string {
  return `https://${CLASS_LMS_HOST}${coursePublicPath(course, "class")}`;
}

export function catalogHref(front: LmsFront): string {
  return catalogPath(front);
}

type ChapterRow = { id: string; course_id?: string | null };

/** Existing IAC chapters have no course_id until the SQL migration runs. */
export function scopeChapterRows<T extends ChapterRow>(
  rows: T[] | null | undefined,
  courseId: string,
  columnPresent: boolean
): { rows: T[]; includeOrphans: boolean } {
  const list = rows || [];
  if (!columnPresent) {
    return {
      rows: courseId === DEFAULT_LMS_COURSE_ID ? list : [],
      includeOrphans: courseId === DEFAULT_LMS_COURSE_ID,
    };
  }
  return {
    rows: list.filter((row) => (row.course_id || DEFAULT_LMS_COURSE_ID) === courseId),
    includeOrphans: false,
  };
}

const CLASSROOM_PREFIX = /^\/courses\/([a-z0-9-]+)\/learn(?:\/.*)?$/;
const CLASS_CLASSROOM_PREFIX = /^\/([a-z0-9-]+)\/learn(?:\/.*)?$/;

export function isLmsClassroomPath(pathname: string): boolean {
  if (pathname === "/student" || pathname.startsWith("/student/")) return true;
  const courses = pathname.match(CLASSROOM_PREFIX);
  if (courses && getLmsCourse(courses[1])) return true;
  const classHost = pathname.match(CLASS_CLASSROOM_PREFIX);
  return Boolean(classHost && getLmsCourse(classHost[1]));
}

export function rewriteClassPathToInternal(pathname: string): string | null {
  if (pathname === "/") return "/courses";
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || !isLmsCourseSlug(slug)) return null;
  const course = getLmsCourse(slug);
  if (!course) return null;
  const rest = parts.slice(1);
  if (course.id === DEFAULT_LMS_COURSE_ID && rest[0] === "learn") {
    const afterLearn = rest.slice(1).join("/");
    return afterLearn ? `/student/${afterLearn}` : "/student";
  }
  return `/courses/${course.slug}${rest.length ? `/${rest.join("/")}` : ""}`;
}

export function classCanonicalStudentPath(pathname: string): string | null {
  if (pathname === "/student" || pathname === "/student/") return "/iac-skills/learn";
  if (pathname.startsWith("/student/")) return `/iac-skills/learn${pathname.slice("/student".length)}`;
  return null;
}
