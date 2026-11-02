import assert from "node:assert/strict";
import test from "node:test";
import {
  coachSentStatsByStudentId,
  mergeThread,
  notificationRowToMessage,
  studentMessagesHref,
  type InboxMessage,
} from "./inbox";

function message(partial: Partial<InboxMessage> & Pick<InboxMessage, "id" | "body">): InboxMessage {
  return {
    studentId: "student-1",
    studentEmail: "nyasham@example.com",
    from: "coach",
    kind: "reply",
    context: "Coach reply",
    lessonId: null,
    createdAt: "2026-10-13T06:12:00.000Z",
    read: true,
    readAt: "2026-10-13T06:12:00.000Z",
    ...partial,
  };
}

test("coach sent stats count Yvonne's inbox messages and keep the latest date", () => {
  const stats = coachSentStatsByStudentId(
    [
      message({ id: "c1", body: "Check-in 1", studentId: "s1", studentEmail: "ada@example.com", createdAt: "2026-10-01T08:00:00.000Z" }),
      message({ id: "c2", body: "Check-in 2", studentId: "s1", studentEmail: "ada@example.com", createdAt: "2026-11-01T08:00:00.000Z" }),
      message({ id: "c3", body: "Ben follow-up", studentId: null, studentEmail: "ben@example.com", createdAt: "2026-10-15T08:00:00.000Z" }),
      message({ id: "q1", body: "Student question", from: "student", studentId: "s1", studentEmail: "ada@example.com", createdAt: "2026-11-02T08:00:00.000Z" }),
    ],
    [
      { id: "s1", email: "ada@example.com" },
      { id: "s2", email: "ben@example.com" },
      { id: "s3", email: "cai@example.com" },
    ]
  );
  assert.equal(stats.s1.count, 2);
  assert.equal(stats.s1.lastAt, "2026-11-01T08:00:00.000Z");
  assert.equal(stats.s2.count, 1);
  assert.equal(stats.s3.count, 0);
  assert.equal(stats.s3.lastAt, null);
  assert.equal(studentMessagesHref("s1"), "/coach/students/s1/messages");
});

test("mergeThread keeps one copy when a coach reply exists in inbox and notifications", () => {
  const inbox = message({ id: "inbox-1", body: "Please upload your BMCR by Friday." });
  const copy = message({
    id: "note-1",
    body: "Please upload your BMCR by Friday.",
    createdAt: "2026-10-13T06:12:03.000Z",
  });
  const merged = mergeThread([inbox, copy]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].id, "inbox-1");
});

test("notification copies of coach replies are not treated as thread messages", () => {
  assert.equal(
    notificationRowToMessage(
      {
        id: "note-1",
        kind: "reply",
        body: "Please upload your BMCR by Friday.",
        from_role: "coach",
        created_at: "2026-10-13T06:12:03.000Z",
      },
      "nyasham@example.com"
    ),
    null
  );
  assert.equal(
    notificationRowToMessage(
      {
        id: "note-2",
        type: "announcement",
        message: "Welcome to the course.",
        from_role: "coach",
        created_at: "2026-10-13T06:12:03.000Z",
      },
      "nyasham@example.com"
    ),
    null
  );
  const question = notificationRowToMessage(
    {
      id: "note-3",
      kind: "question",
      body: "Where do I find the worksheet?",
      from_role: "student",
      created_at: "2026-10-13T06:00:00.000Z",
    },
    "nyasham@example.com"
  );
  assert.equal(question?.kind, "question");
  assert.equal(question?.from, "student");
});
