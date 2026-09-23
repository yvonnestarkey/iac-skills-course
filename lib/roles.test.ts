import test from "node:test";
import assert from "node:assert/strict";
import { isCoachAccount, staffRoleFromAppMetadata, studentUserRoleFromAuth } from "./roles";
import { studentUserFromAuth } from "./student-lesson";

test("user_metadata.role cannot make a student a coach", () => {
  const forged = studentUserFromAuth({
    id: "student-1",
    email: "s1@test.com",
    user_metadata: { role: "coach" },
    app_metadata: {},
  });
  assert.equal(forged.role, null);
  assert.equal(isCoachAccount(forged), false);
  assert.equal(
    isCoachAccount({
      id: "student-1",
      email: "s1@test.com",
      user_metadata: { role: "admin" },
      app_metadata: {},
    }),
    false
  );
  assert.equal(studentUserRoleFromAuth({ user_metadata: { role: "coach" }, app_metadata: {} }), null);
});

test("app_metadata.role and bootstrap emails remain authoritative", () => {
  assert.equal(staffRoleFromAppMetadata({ role: "coach" }), "coach");
  assert.equal(
    isCoachAccount({
      id: "staff-1",
      email: "tutor@example.com",
      app_metadata: { role: "coach" },
      user_metadata: {},
    }),
    true
  );
  assert.equal(
    isCoachAccount({
      id: "staff-2",
      email: "yvonne@accountingstudyadvice.com",
      app_metadata: {},
      user_metadata: {},
    }),
    true
  );
});
