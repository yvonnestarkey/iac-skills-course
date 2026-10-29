import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_LMS_COURSE_ID,
  LMS_COURSES,
  canonicalCourseSlug,
  classCanonicalStudentPath,
  courseClassroomPath,
  getLmsCourse,
  isLmsClassroomPath,
  isLmsCourseSlug,
  rewriteClassPathToInternal,
  scopeChapterRows,
} from "./lms-catalog";
import { CLASS_LMS_HOST, IAC_LMS_HOST, isClassLmsHost, lmsFrontFromHost } from "./lms-hosts";

test("class. is the multi-course host and iac. stays the IAC Skills host", () => {
  assert.equal(CLASS_LMS_HOST, "class.accountingstudyadvice.com");
  assert.equal(IAC_LMS_HOST, "iac.accountingstudyadvice.com");
  assert.equal(isClassLmsHost("class.accountingstudyadvice.com"), true);
  assert.equal(isClassLmsHost("iac.accountingstudyadvice.com"), false);
  assert.equal(lmsFrontFromHost("localhost:3000"), "iac");
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

test("class. public paths rewrite to internal /courses routes", () => {
  assert.equal(rewriteClassPathToInternal("/"), "/courses");
  assert.equal(rewriteClassPathToInternal("/iac-skills"), "/courses/iac-skills");
  assert.equal(rewriteClassPathToInternal("/iac-skills/learn"), "/student");
  assert.equal(rewriteClassPathToInternal("/iac-skills/learn/ch3-l1"), "/student/ch3-l1");
  assert.equal(rewriteClassPathToInternal("/cta-skills/learn"), "/courses/cta-skills/learn");
  assert.equal(rewriteClassPathToInternal("/auditrisk"), "/courses/controls");
  assert.equal(rewriteClassPathToInternal("/login"), null);
});

test("IAC classroom on class. is the same /student app via a slug path", () => {
  assert.equal(courseClassroomPath(getLmsCourse("iac-skills")!, "class"), "/iac-skills/learn");
  assert.equal(courseClassroomPath(getLmsCourse("iac-skills")!, "iac"), "/student");
  assert.equal(classCanonicalStudentPath("/student/dashboard"), "/iac-skills/learn/dashboard");
  assert.equal(isLmsClassroomPath("/courses/cta-skills/learn/ch1-l1"), true);
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
