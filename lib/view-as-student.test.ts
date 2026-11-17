import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  VIEW_AS_STUDENT_COOKIE,
  VIEW_AS_STUDENT_HOME,
  canStartViewAsStudent,
  parseViewAsStudentId,
  viewAsDisplayName,
  viewAsStudentUser,
} from "./view-as-student";

const coach = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "yvonne@accountingstudyadvice.com",
  role: "coach",
};
const studentId = "22222222-2222-4222-8222-222222222222";

test("only a coach can start a read-only view of another student", () => {
  assert.equal(canStartViewAsStudent(coach, studentId), true);
  assert.equal(canStartViewAsStudent(coach, coach.id), false);
  assert.equal(canStartViewAsStudent({ id: studentId, email: "ada@example.com", role: "student" }, studentId), false);
  assert.equal(canStartViewAsStudent(coach, "not-a-uuid"), false);
  assert.equal(parseViewAsStudentId(studentId), studentId);
  assert.equal(parseViewAsStudentId(""), null);
});

test("view-as student users are not treated as staff", () => {
  const viewed = viewAsStudentUser({
    id: studentId,
    email: "ada@example.com",
    full_name: "Ada Lovelace",
  });
  assert.equal(viewed.id, studentId);
  assert.equal(viewed.email, "ada@example.com");
  assert.equal(viewed.full_name, "Ada Lovelace");
  assert.equal(viewed.role, null);
  assert.equal(viewAsDisplayName(viewed), "Ada Lovelace");
});

test("coach profile and student shell expose view-as preview", () => {
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const shell = readFileSync(resolve("components/student/StudentShell.tsx"), "utf8");
  const session = readFileSync(resolve("lib/student-session.tsx"), "utf8");
  const layout = readFileSync(resolve("app/coach/layout.tsx"), "utf8");
  const api = readFileSync(resolve("app/api/coach/view-as/route.ts"), "utf8");
  const lessons = readFileSync(resolve("app/api/student/lessons/[lessonId]/route.ts"), "utf8");
  const outline = readFileSync(resolve("app/api/student/outline/route.ts"), "utf8");
  const inbox = readFileSync(resolve("lib/use-student-inbox.ts"), "utf8");
  const player = readFileSync(resolve("components/student/StudentPlayer.tsx"), "utf8");
  assert.match(profile, /View as student/);
  assert.match(profile, /startViewAsStudent/);
  assert.match(shell, /ViewAsBanner/);
  assert.match(shell, /view-as-readonly/);
  assert.match(session, /viewAsStudent/);
  assert.match(session, /readOnly: Boolean\(viewAsStudent\)/);
  assert.match(session, /authUser/);
  assert.match(layout, /authUser \|\| user/);
  assert.match(api, /isStaffUser/);
  assert.match(api, /VIEW_AS_STUDENT_COOKIE/);
  assert.equal(VIEW_AS_STUDENT_HOME, "/student/dashboard");
  assert.match(lessons, /getClassroomSubjectUser/);
  assert.match(outline, /getClassroomSubjectUser/);
  assert.match(inbox, /fetchCoachStudentThread/);
  assert.match(player, /readOnly/);
});
