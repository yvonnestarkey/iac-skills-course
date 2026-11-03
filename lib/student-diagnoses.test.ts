import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { matchRosterRule, rosterRuleValue, rosterRuleValues } from "./roster";
import {
  diagnosisLabel,
  hasDiagnosis,
  mergeDiagnosisTypes,
  normalizeDiagnosisId,
  STUDENT_DIAGNOSIS_TYPES,
} from "./student-diagnoses";

test("the first diagnoses are RTFQ and Case Study Reading", () => {
  assert.deepEqual(
    STUDENT_DIAGNOSIS_TYPES.map((item) => item.label),
    ["RTFQ", "Case Study Reading"]
  );
  assert.equal(normalizeDiagnosisId("Case Study Reading"), "case-study-reading");
  assert.equal(diagnosisLabel("rtfq"), "RTFQ");
  assert.equal(hasDiagnosis(["rtfq"], "RTFQ"), true);
  assert.equal(mergeDiagnosisTypes([{ id: "rtfq", label: "RTFQ" }, { id: "buried-treasure", label: "Buried Treasure" }]).length, 3);
});

test("the roster can select students who share a diagnosis", () => {
  const student = {
    name: "Ada",
    email: "ada@example.com",
    cohort: "jan27",
    diagnoses: ["rtfq", "case-study-reading"],
  };
  assert.equal(rosterRuleValue(student, "diagnosis"), "rtfq | case-study-reading");
  assert.deepEqual(rosterRuleValues(student, "diagnosis"), ["rtfq", "case-study-reading"]);
  assert.equal(
    matchRosterRule(student, { id: "r1", field: "diagnosis", operator: "is", values: ["rtfq"] }),
    true
  );
  assert.equal(
    matchRosterRule(student, { id: "r2", field: "diagnosis", operator: "is", values: ["buried-treasure"] }),
    false
  );
  assert.equal(
    matchRosterRule({ ...student, diagnoses: [] }, { id: "r3", field: "diagnosis", operator: "is_empty", values: [] }),
    true
  );
});

test("admin tools sit on the profile banner, not the main page", () => {
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/student-diagnoses.sql"), "utf8");
  assert.match(profile, /Registration/);
  assert.match(profile, /Password/);
  assert.match(profile, /Data choices/);
  assert.match(profile, /adminView === "registration"/);
  assert.match(profile, /StudentDiagnosesPanel/);
  assert.match(sql, /student_diagnoses/);
  assert.match(sql, /case-study-reading/);
});
