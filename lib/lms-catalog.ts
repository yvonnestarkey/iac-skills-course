import { iacClassroomUrl, iacSalesUrl, type LmsFront } from "./lms-hosts";
export { iacClassroomUrl, iacSalesUrl, publicCatalogUrl } from "./lms-hosts";

export const DEFAULT_LMS_COURSE_ID = "iac-skills";

export type LmsCourseStatus = "live" | "import-ready";

export type LmsCourse = {
  id: string;
  slug: string;
  /** Extra public paths that resolve to this course. */
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
    summary: "The live January 2027 IAC Skills classroom on iac.accountingstudyadvice.com.",
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

/** IAC Skills always leaves this app’s catalog and opens iac. Other courses stay under /courses/<slug>. */
export function coursePublicHref(course: LmsCourse): string {
  if (course.id === DEFAULT_LMS_COURSE_ID) return iacSalesUrl();
  return `/courses/${course.slug}`;
}

export function courseClassroomHref(course: LmsCourse): string {
  if (course.id === DEFAULT_LMS_COURSE_ID) return iacClassroomUrl();
  return `/courses/${course.slug}/learn`;
}

export function coursePublicPath(course: LmsCourse, _front: LmsFront = "catalog"): string {
  return coursePublicHref(course);
}

export function courseClassroomPath(course: LmsCourse, _front: LmsFront = "catalog"): string {
  return courseClassroomHref(course);
}

export function catalogHref(_front?: LmsFront): string {
  return "/courses";
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
  if (courses && getLmsCourse(courses[1]) && courses[1] !== DEFAULT_LMS_COURSE_ID) return true;
  const classHost = pathname.match(CLASS_CLASSROOM_PREFIX);
  return Boolean(classHost && getLmsCourse(classHost[1]) && classHost[1] !== DEFAULT_LMS_COURSE_ID);
}

export function rewriteClassPathToInternal(pathname: string): string | null {
  if (pathname === "/") return "/courses";
  const parts = pathname.split("/").filter(Boolean);
  const slug = parts[0];
  if (!slug || !isLmsCourseSlug(slug)) return null;
  const course = getLmsCourse(slug);
  if (!course || course.id === DEFAULT_LMS_COURSE_ID) return null;
  const rest = parts.slice(1);
  return `/courses/${course.slug}${rest.length ? `/${rest.join("/")}` : ""}`;
}

/** On class., send leftover IAC student URLs to the real IAC host instead of keeping a second classroom. */
export function classCanonicalStudentPath(pathname: string): string | null {
  if (pathname === "/student" || pathname === "/student/" || pathname.startsWith("/student/")) {
    return iacClassroomUrl() + (pathname === "/student" || pathname === "/student/" ? "" : pathname.slice("/student".length));
  }
  if (pathname === "/iac-skills" || pathname === "/iac-skills/") return iacSalesUrl();
  if (pathname === "/iac-skills/learn" || pathname.startsWith("/iac-skills/learn/")) {
    const rest = pathname.slice("/iac-skills/learn".length);
    return rest && rest !== "/" ? `${iacClassroomUrl()}${rest}` : iacClassroomUrl();
  }
  return null;
}
