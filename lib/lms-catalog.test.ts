import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LMS_COURSE_ID,
  LMS_COURSES,
  canonicalCourseSlug,
  classCanonicalStudentPath,
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
} from "./lms-hosts";

test("iac. stays IAC-only; catalog is class.accountingstudyadvice.com", () => {
  assert.equal(IAC_LMS_HOST, "iac.accountingstudyadvice.com");
  assert.equal(CLASS_LMS_HOST, "class.accountingstudyadvice.com");
  assert.equal(publicCatalogUrl(), `${CLASS_LMS_ORIGIN}/`);
  assert.equal(isCatalogHost("class.accountingstudyadvice.com"), true);
  assert.equal(isCatalogHost("accountingstudyadvice.com"), false);
  assert.equal(isCatalogHost("iac.accountingstudyadvice.com"), false);
  assert.equal(isClassLmsHost("iac.accountingstudyadvice.com"), false);
  assert.equal(lmsFrontFromHost("localhost:3000"), "iac");
  assert.equal(lmsFrontFromHost("class.accountingstudyadvice.com"), "class");
  assert.equal(lmsFrontFromHost("accountingstudyadvice.com"), "iac");
});

test("catalog slugs cover the known Accounting Study Advice courses", () => {
  assert.deepEqual(
    LMS_COURSES.map((course) => course.slug),
    ["iac-skills", "cta-skills", "controls", "substantive", "strategy-mindset"]
  );
  assert.equal(getLmsCourse("auditrisk")?.slug, "controls");
  assert.equal(canonicalCourseSlug("auditrisk"), "controls");
  assert.equal(isLmsCourseSlug("login"), false);
});

test("IAC catalog links go to iac.; other courses are /<slug> on class. (e.g. /auditrisk)", () => {
  const iac = getLmsCourse("iac-skills")!;
  const cta = getLmsCourse("cta-skills")!;
  const controls = getLmsCourse("controls")!;
  assert.equal(coursePublicHref(iac), `${IAC_LMS_ORIGIN}/`);
  assert.equal(courseClassroomHref(iac), `${IAC_LMS_ORIGIN}/student`);
  assert.equal(coursePublicHref(cta, "class"), "/cta-skills");
  assert.equal(courseClassroomHref(cta, "class"), "/cta-skills/learn");
  assert.equal(coursePublicHref(controls, "class"), "/auditrisk");
  assert.equal(coursePublicHref(cta, "iac"), "/courses/cta-skills");
  assert.equal(courseClassroomHref(cta, "iac"), "/courses/cta-skills/learn");
});

test("class. short paths rewrite to /courses except IAC, which is not kept on class.", () => {
  assert.equal(rewriteClassPathToInternal("/"), "/courses");
  assert.equal(rewriteClassPathToInternal("/cta-skills/learn"), "/courses/cta-skills/learn");
  assert.equal(rewriteClassPathToInternal("/auditrisk"), "/courses/controls");
  assert.equal(rewriteClassPathToInternal("/iac-skills"), null);
  assert.equal(rewriteClassPathToInternal("/login"), null);
  assert.equal(classCanonicalStudentPath("/student"), `${IAC_LMS_ORIGIN}/student`);
  assert.equal(classCanonicalStudentPath("/iac-skills"), `${IAC_LMS_ORIGIN}/`);
  assert.equal(isLmsClassroomPath("/courses/cta-skills/learn/ch1-l1"), true);
  assert.equal(isLmsClassroomPath("/courses/iac-skills/learn"), false);
});

test("chapters without course_id stay on IAC Skills until the SQL migration runs", () => {
  const rows = [
    { id: "ch3", course_id: null },
    { id: "cta-1", course_id: "cta-skills" },
  ];
  const legacy = scopeChapterRows(rows, DEFAULT_LMS_COURSE_ID, false);
  assert.deepEqual(
    legacy.rows.map((row) => row.id),
    ["ch3", "cta-1"]
  );
  assert.equal(legacy.includeOrphans, true);
  assert.deepEqual(
    scopeChapterRows(rows, "cta-skills", false).rows.map((row) => row.id),
    []
  );
  assert.deepEqual(
    scopeChapterRows(rows, DEFAULT_LMS_COURSE_ID, true).rows.map((row) => row.id),
    ["ch3"]
  );
  assert.deepEqual(
    scopeChapterRows(rows, "cta-skills", true).rows.map((row) => row.id),
    ["cta-1"]
  );
});
