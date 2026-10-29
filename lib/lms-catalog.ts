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
  /** Public Thinkific sales page. Player (/take/…) URLs are not guessed. */
  thinkificUrl: string | null;
};

const THINKIFIC_SCHOOL = "courses.accountingstudyadvice.com";
const IMPORT_SUMMARY =
  "Classroom ready. Lessons appear here once this Thinkific course is imported — no lesson copy has been added yet.";

export const LMS_COURSES: LmsCourse[] = [
  {
    id: "iac-skills",
    slug: "iac-skills",
    aliases: [],
    title: "IAC Skills",
    shortTitle: "IAC Skills Course",
    status: "live",
    productId: "jan27-iac",
    summary: "The live January 2027 IAC Skills classroom on iac.accountingstudyadvice.com. Not imported from Thinkific.",
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: null,
  },
  {
    id: "mindset-masterclass",
    slug: "mindset-masterclass",
    aliases: [],
    title: "Mindset Masterclass",
    shortTitle: "Mindset Masterclass",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/mindset-masterclass",
  },
  {
    id: "teaching-mindset-skills",
    slug: "teaching-mindset-skills",
    aliases: ["growthmindseteducators"],
    title: "Teaching Mindset & Skills",
    shortTitle: "Teaching Mindset & Skills",
    status: "live",
    productId: null,
    summary: "Imported from Thinkific. Open the classroom to work through the lessons.",
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/growthmindseteducators",
  },
  {
    id: "what-firms-want",
    slug: "what-firms-want",
    aliases: ["trainee-course"],
    title: "What firms want you to know",
    shortTitle: "What firms want you to know",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/trainee-course",
  },
  {
    id: "isa-520-analytical-review",
    slug: "isa-520-analytical-review",
    aliases: [],
    title: "Auditing: ISA520 Analytical Review",
    shortTitle: "ISA520 Analytical Review",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/isa-520-analytical-review",
  },
  {
    id: "navigating-reference-books",
    slug: "navigating-reference-books",
    aliases: [],
    title: "Navigating Reference Books",
    shortTitle: "Navigating Reference Books",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/navigating-reference-books",
  },
  {
    id: "audit-risk-and-planning",
    slug: "audit-risk-and-planning",
    aliases: ["auditrisk"],
    title: "Audit: Risk and Planning",
    shortTitle: "Audit: Risk and Planning",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/audit-risk-and-planning",
  },
  {
    id: "finalisation-of-the-audit",
    slug: "finalisation-of-the-audit",
    aliases: [],
    title: "Finalisation of the Audit",
    shortTitle: "Finalisation of the Audit",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/finalisation-of-the-audit",
  },
  {
    id: "auditing-controls",
    slug: "auditing-controls",
    aliases: ["controls"],
    title: "Auditing: Controls",
    shortTitle: "Auditing: Controls",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/auditing-controls",
  },
  {
    id: "auditing-substantive-procedures",
    slug: "auditing-substantive-procedures",
    aliases: ["substantive"],
    title: "Auditing: Substantive Procedures",
    shortTitle: "Auditing: Substantive Procedures",
    status: "import-ready",
    productId: null,
    summary: IMPORT_SUMMARY,
    thinkificSchool: THINKIFIC_SCHOOL,
    thinkificUrl: "https://courses.accountingstudyadvice.com/courses/auditing-substantive-procedures",
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

/** class. public paths for every non-IAC course, including aliases. */
export function classHostCoursePaths(): { slug: string; internal: string }[] {
  return LMS_COURSES.filter((course) => course.id !== DEFAULT_LMS_COURSE_ID).flatMap((course) =>
    [course.slug, ...course.aliases].map((slug) => ({ slug, internal: course.slug }))
  );
}

export function isLmsCourseSlug(value: string | null | undefined): boolean {
  return Boolean(value && bySlug.has(value));
}

export function canonicalCourseSlug(slugOrId: string): string | null {
  return getLmsCourse(slugOrId)?.slug ?? null;
}

export function coursePublicSlug(course: LmsCourse): string {
  return course.slug;
}

/** IAC Skills always opens iac. Other courses are /<slug> on class. */
export function coursePublicHref(course: LmsCourse, front: LmsFront = "class"): string {
  if (course.id === DEFAULT_LMS_COURSE_ID) return iacSalesUrl();
  if (front === "class") return `/${coursePublicSlug(course)}`;
  return `/courses/${course.slug}`;
}

export function courseClassroomHref(course: LmsCourse, front: LmsFront = "class"): string {
  if (course.id === DEFAULT_LMS_COURSE_ID) return iacClassroomUrl();
  if (front === "class") return `/${coursePublicSlug(course)}/learn`;
  return `/courses/${course.slug}/learn`;
}

export function coursePublicPath(course: LmsCourse, front: LmsFront = "class"): string {
  return coursePublicHref(course, front);
}

export function courseClassroomPath(course: LmsCourse, front: LmsFront = "class"): string {
  return courseClassroomHref(course, front);
}

export function catalogHref(front: LmsFront = "class"): string {
  return front === "class" ? "/" : "/courses";
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
