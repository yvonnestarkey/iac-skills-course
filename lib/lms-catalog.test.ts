import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LMS_COURSE_ID,
  LMS_COURSES,
  canonicalCourseSlug,
  classCanonicalStudentPath,
  classHostCoursePaths,
  courseClassroomHref,
  coursePublicHref,
  getLmsCourse,
  isLmsClassroomPath,
  isLmsCourseSlug,
  rewriteClassPathToInternal,
  scopeChapterRows,
} from "./lms-catalog";
import {
  CLASS_LMS_HOST,
  CLASS_LMS_ORIGIN,
  IAC_LMS_HOST,
  IAC_LMS_ORIGIN,
  isCatalogHost,
  isClassLmsHost,
  lmsFrontFromHost,
  publicCatalogUrl,
  resolvedCatalogOrigin,
} from "./lms-hosts";

test("iac. stays IAC-only; catalog is class.accountingstudyadvice.com", () => {
  assert.equal(IAC_LMS_HOST, "iac.accountingstudyadvice.com");
  assert.equal(CLASS_LMS_HOST, "class.accountingstudyadvice.com");
  assert.equal(publicCatalogUrl(), `${CLASS_LMS_ORIGIN}/`);
  assert.equal(resolvedCatalogOrigin("https://accountingstudyadvice.com"), CLASS_LMS_ORIGIN);
  assert.equal(resolvedCatalogOrigin("https://class.accountingstudyadvice.com"), CLASS_LMS_ORIGIN);
  assert.equal(isCatalogHost("class.accountingstudyadvice.com"), true);
  assert.equal(isCatalogHost("accountingstudyadvice.com"), false);
  assert.equal(isCatalogHost("iac.accountingstudyadvice.com"), false);
  assert.equal(isClassLmsHost("iac.accountingstudyadvice.com"), false);
  assert.equal(lmsFrontFromHost("localhost:3000"), "iac");
  assert.equal(lmsFrontFromHost("class.accountingstudyadvice.com"), "class");
  assert.equal(lmsFrontFromHost("accountingstudyadvice.com"), "iac");
});

test("catalog slugs are IAC plus the nine Thinkific courses Yvonne named", () => {
  assert.deepEqual(
    LMS_COURSES.map((course) => course.slug),
    [
      "iac-skills",
      "mindset-masterclass",
      "teaching-mindset-skills",
      "what-firms-want",
      "isa-520-analytical-review",
      "navigating-reference-books",
      "audit-risk-and-planning",
      "finalisation-of-the-audit",
      "auditing-controls",
      "auditing-substantive-procedures",
    ]
  );
  assert.equal(getLmsCourse("cta-skills"), null);
  assert.equal(getLmsCourse("auditrisk")?.slug, "audit-risk-and-planning");
  assert.equal(canonicalCourseSlug("growthmindseteducators"), "teaching-mindset-skills");
  assert.equal(isLmsCourseSlug("login"), false);
  for (const course of LMS_COURSES.filter((row) => row.id !== DEFAULT_LMS_COURSE_ID)) {
    assert.match(course.thinkificUrl || "", /^https:\/\/courses\.accountingstudyadvice\.com\/courses\//);
  }
  assert.equal(
    classHostCoursePaths().some((row) => row.slug === "auditrisk" && row.internal === "audit-risk-and-planning"),
    true
  );
});

test("IAC catalog links go to iac.; other courses are /<slug> on class.", () => {
  const iac = getLmsCourse("iac-skills")!;
  const mindset = getLmsCourse("mindset-masterclass")!;
  const risk = getLmsCourse("audit-risk-and-planning")!;
  assert.equal(coursePublicHref(iac), `${IAC_LMS_ORIGIN}/`);
  assert.equal(courseClassroomHref(iac), `${IAC_LMS_ORIGIN}/student`);
  assert.equal(coursePublicHref(mindset, "class"), "/mindset-masterclass");
  assert.equal(courseClassroomHref(mindset, "class"), "/mindset-masterclass/learn");
  assert.equal(coursePublicHref(risk, "class"), "/audit-risk-and-planning");
  assert.equal(coursePublicHref(mindset, "iac"), "/courses/mindset-masterclass");
  assert.equal(courseClassroomHref(mindset, "iac"), "/courses/mindset-masterclass/learn");
});

test("class. short paths rewrite to /courses except IAC, which is not kept on class.", () => {
  assert.equal(rewriteClassPathToInternal("/"), "/courses");
  assert.equal(rewriteClassPathToInternal("/mindset-masterclass/learn"), "/courses/mindset-masterclass/learn");
  assert.equal(rewriteClassPathToInternal("/auditrisk"), "/courses/audit-risk-and-planning");
  assert.equal(rewriteClassPathToInternal("/iac-skills"), null);
  assert.equal(rewriteClassPathToInternal("/login"), null);
  assert.equal(classCanonicalStudentPath("/student"), `${IAC_LMS_ORIGIN}/student`);
  assert.equal(classCanonicalStudentPath("/iac-skills"), `${IAC_LMS_ORIGIN}/`);
  assert.equal(isLmsClassroomPath("/courses/mindset-masterclass/learn/ch1-l1"), true);
  assert.equal(isLmsClassroomPath("/courses/iac-skills/learn"), false);
});

test("chapters without course_id stay on IAC Skills until the SQL migration runs", () => {
  const rows = [
    { id: "ch3", course_id: null },
    { id: "audit-1", course_id: "auditing-controls" },
  ];
  const legacy = scopeChapterRows(rows, DEFAULT_LMS_COURSE_ID, false);
  assert.deepEqual(
    legacy.rows.map((row) => row.id),
    ["ch3", "audit-1"]
  );
  assert.equal(legacy.includeOrphans, true);
  assert.deepEqual(
    scopeChapterRows(rows, "auditing-controls", false).rows.map((row) => row.id),
    []
  );
  assert.deepEqual(
    scopeChapterRows(rows, DEFAULT_LMS_COURSE_ID, true).rows.map((row) => row.id),
    ["ch3"]
  );
  assert.deepEqual(
    scopeChapterRows(rows, "auditing-controls", true).rows.map((row) => row.id),
    ["audit-1"]
  );
});
