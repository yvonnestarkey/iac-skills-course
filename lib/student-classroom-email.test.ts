import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  buildClassroomEmail,
  classroomEmailIdempotencyKey,
  classroomEmailSubject,
  classroomPath,
  classroomPreviewText,
  classroomUrl,
  scriptEvaluationPreview,
  sendClassroomEmails,
} from "./student-classroom-email";

test("classroom emails include the full message and a deep link into the relevant area", () => {
  const announcement = buildClassroomEmail({
    kind: "announcement",
    title: "Live session Tuesday",
    message: "We start at 18:00 SAST. Bring your Task 1 notes.",
    href: "https://iac.accountingstudyadvice.com/student/notifications/note-1",
    studentName: "Nyasham Ncube",
  });
  assert.equal(announcement.subject, "Live session Tuesday");
  assert.match(announcement.text, /Hi Nyasham,/);
  assert.match(announcement.text, /We start at 18:00 SAST/);
  assert.match(announcement.text, /Open this notification: https:\/\/iac\.accountingstudyadvice\.com\/student\/notifications\/note-1/);
  assert.match(announcement.html, /We start at 18:00 SAST/);
  assert.match(announcement.html, /href="https:\/\/iac\.accountingstudyadvice\.com\/student\/notifications\/note-1"/);

  assert.equal(classroomPath("message"), "/student/inbox");
  assert.equal(classroomPath("assignment_feedback"), "/student/feedback");
  assert.equal(classroomPath("script_evaluation", { attemptId: "attempt-9" }), "/student/evaluator/attempt/attempt-9/submitted");
  assert.equal(
    classroomUrl("announcement", { id: "note-1", origin: "https://iac.accountingstudyadvice.com" }),
    "https://iac.accountingstudyadvice.com/student/notifications/note-1"
  );
});

test("assignment feedback and coach replies keep their classroom destinations", () => {
  assert.equal(classroomEmailSubject("message", "Coach reply"), "New message: Coach reply");
  assert.equal(classroomEmailSubject("assignment_feedback", "Reviewed: Task 1"), "Reviewed: Task 1");
  assert.match(
    classroomPreviewText("Open it here: [Open your review](/student/surveys/task-1)", "https://iac.accountingstudyadvice.com"),
    /https:\/\/iac\.accountingstudyadvice\.com\/student\/surveys\/task-1/
  );
});

test("script evaluation emails include the report preview", () => {
  const preview = scriptEvaluationPreview({
    paperName: "IAC January 2026 Paper 1",
    headline: "Knowledge is landing; application is leaking marks.",
    takeaways: ["State the issue before the calculation."],
    actionPlan: ["Redo Q1 with the issue-first heading."],
  });
  assert.match(preview, /IAC January 2026 Paper 1/);
  assert.match(preview, /Knowledge is landing/);
  assert.match(preview, /Redo Q1/);
  const email = buildClassroomEmail({
    kind: "script_evaluation",
    title: "Your script evaluation is ready",
    message: preview,
    href: "/student/evaluator/attempt/attempt-9/submitted",
    origin: "https://iac.accountingstudyadvice.com",
  });
  assert.match(email.text, /Redo Q1/);
  assert.match(email.text, /https:\/\/iac\.accountingstudyadvice\.com\/student\/evaluator\/attempt\/attempt-9\/submitted/);
});

test("classroom emails send one Resend message per student and do not stack retries on the same record", async () => {
  const sent: string[] = [];
  const result = await sendClassroomEmails(
    {
      kind: "announcement",
      title: "Live session Tuesday",
      message: "We start at 18:00 SAST.",
      recipients: [
        { email: "ada@example.com", name: "Ada Student", recordId: "note-1" },
        { email: "not-an-email", recordId: "note-2" },
        { email: "nyasham@example.com", name: "Nyasham", recordId: "note-3" },
      ],
      origin: "https://iac.accountingstudyadvice.com",
    },
    async (payload) => {
      sent.push(String(payload.to));
      assert.equal(payload.idempotencyKey, classroomEmailIdempotencyKey("announcement", { email: String(payload.to), recordId: sent.length === 1 ? "note-1" : "note-3" }));
      assert.match(payload.text, /We start at 18:00 SAST/);
      return { id: "email-1" };
    }
  );
  assert.equal(result.sent, 2);
  assert.equal(result.failed, 0);
  assert.deepEqual(sent, ["ada@example.com", "nyasham@example.com"]);
});

test("notifications, messages, assignment feedback, and script evaluations all send the classroom email", () => {
  const notifications = readFileSync(resolve("lib/notifications.ts"), "utf8");
  const composer = readFileSync(resolve("components/NotifyComposer.tsx"), "utf8");
  const evaluate = readFileSync(resolve("app/api/evaluate-script/route.ts"), "utf8");
  const inbox = readFileSync(resolve("lib/inbox.ts"), "utf8");
  const surveys = readFileSync(resolve("lib/custom-surveys.ts"), "utf8");
  assert.match(notifications, /requestClassroomEmails/);
  assert.match(notifications, /kind === "reply"\) return "message"/);
  assert.match(composer, /insertCoachNotifications/);
  assert.match(inbox, /notifyAssignmentFeedback/);
  assert.match(inbox, /insertCoachNotifications/);
  assert.match(surveys, /notifyAssignmentFeedback/);
  assert.match(evaluate, /emailScriptEvaluationToStudent/);
  assert.equal(readFileSync(resolve("lib/notification-catchup-admin.ts"), "utf8").includes("requestClassroomEmails"), false);
});
