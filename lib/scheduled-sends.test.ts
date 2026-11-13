import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { sastDateAndTimeToIso } from "./dates";
import {
  emptyScheduleFields,
  scheduleModeLabel,
  scheduledSendDue,
  scheduledSendFinished,
  scheduledTriggerLabel,
  scheduledWriteFromFields,
  validateScheduledSendWrite,
} from "./scheduled-sends";

const student = { id: "11111111-1111-4111-8111-111111111111", email: "ada@example.com", name: "Ada" };

test("scheduled sends wait for the chosen time, lesson, or Task", () => {
  const now = new Date("2026-11-13T08:00:00.000Z");
  assert.equal(
    scheduledSendDue({ trigger: "at_time", sendAt: "2026-11-13T07:59:00.000Z", lessonId: null, taskId: null }, { now }),
    true
  );
  assert.equal(
    scheduledSendDue({ trigger: "at_time", sendAt: "2026-11-13T08:01:00.000Z", lessonId: null, taskId: null }, { now }),
    false
  );
  assert.equal(
    scheduledSendDue(
      { trigger: "lesson_completed", sendAt: null, lessonId: "lesson-9", taskId: null },
      { now, completedLessonIds: ["lesson-9"] }
    ),
    true
  );
  assert.equal(
    scheduledSendDue(
      { trigger: "lesson_completed", sendAt: null, lessonId: "lesson-9", taskId: null },
      { now, completedLessonIds: ["lesson-8"] }
    ),
    false
  );
  assert.equal(
    scheduledSendDue(
      { trigger: "task_submitted", sendAt: null, lessonId: null, taskId: "task-2" },
      { now, submittedLessonIds: ["task-2"] }
    ),
    true
  );
});

test("drafting a send now skips the schedule table", () => {
  const planned = scheduledWriteFromFields(emptyScheduleFields(), {
    channel: "notification",
    title: "Thursday live session",
    body: "See you at 18:00.",
    recipients: [student],
  });
  assert.deepEqual(planned, { ok: true, now: true });
});

test("a timed notification needs a subject and a valid SAST datetime", () => {
  const missing = validateScheduledSendWrite({
    channel: "notification",
    body: "See you at 18:00.",
    recipients: [student],
    trigger: "at_time",
  });
  assert.equal(missing.ok, false);

  const sendAt = sastDateAndTimeToIso("2026-11-20", "08:00");
  const saved = scheduledWriteFromFields(
    { mode: "at_time", sendAtDate: "2026-11-20", sendAtTime: "08:00", lessonId: "", taskId: "" },
    { channel: "notification", title: "Thursday live session", body: "See you at 18:00.", recipients: [student] }
  );
  assert.equal(saved.ok, true);
  assert.equal("write" in saved && saved.write.sendAt, sendAt);
});

test("messages can be a PDF on its own and wait until a Task is submitted", () => {
  const saved = scheduledWriteFromFields(
    { mode: "task_submitted", sendAtDate: "", sendAtTime: "", lessonId: "", taskId: "task-2" },
    { channel: "message", body: "", pdfUrl: "https://files.example/notes.pdf", pdfName: "notes.pdf", recipients: [student] }
  );
  assert.equal(saved.ok, true);
  assert.equal("write" in saved && saved.write.trigger, "task_submitted");
  assert.equal("write" in saved && saved.write.taskId, "task-2");
});

test("waiting sends stay on the dashboard until every recipient has them", () => {
  assert.equal(scheduleModeLabel("lesson_completed"), "When they complete a lesson");
  assert.match(scheduledTriggerLabel({ trigger: "at_time", sendAt: "2026-11-20T06:00:00.000Z", lessonId: null, taskId: null }), /At /);
  assert.equal(
    scheduledSendFinished({
      id: "s1",
      channel: "message",
      messageKind: "reply",
      title: "",
      body: "Hello",
      pdfUrl: "",
      pdfName: "",
      audience: "student",
      audienceLabel: "Ada",
      recipients: [student],
      trigger: "at_time",
      sendAt: "2026-11-20T06:00:00.000Z",
      lessonId: null,
      taskId: null,
      createdAt: "2026-11-13T06:00:00.000Z",
      cancelledAt: null,
      deliveredCount: 0,
    }),
    false
  );
});

test("notifications and inbox composers can schedule a send", () => {
  const notify = readFileSync(resolve("components/NotifyComposer.tsx"), "utf8");
  const inbox = readFileSync(resolve("components/coach/CoachInbox.tsx"), "utf8");
  const thread = readFileSync(resolve("components/coach/AskCoachThread.tsx"), "utf8");
  const group = readFileSync(resolve("components/coach/ActivityMessageModal.tsx"), "utf8");
  const dash = readFileSync(resolve("components/coach/CoachHomeDashboard.tsx"), "utf8");
  const catchup = readFileSync(resolve("app/api/student/notifications/catch-up/route.ts"), "utf8");
  const progress = readFileSync(resolve("lib/student-lesson.ts"), "utf8");
  const submitted = readFileSync(resolve("app/api/student/assignment-submitted/route.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/scheduled-sends.sql"), "utf8");
  const fields = readFileSync(resolve("components/coach/ScheduleSendFields.tsx"), "utf8");
  assert.match(notify, /ScheduleSendFields/);
  assert.match(notify, /createScheduledSend/);
  assert.match(inbox, /ScheduleSendFields/);
  assert.match(thread, /ScheduleSendFields/);
  assert.match(group, /ScheduleSendFields/);
  assert.match(dash, /CoachScheduledSends/);
  assert.match(catchup, /claimDueScheduledSends/);
  assert.match(progress, /\/api\/student\/notifications\/catch-up/);
  assert.match(submitted, /claimDueScheduledSends/);
  assert.match(sql, /create table if not exists public\.scheduled_sends/);
  assert.match(sql, /create table if not exists public\.scheduled_send_deliveries/);
  assert.match(fields, /scheduleModeLabel/);
  assert.match(fields, /lesson_completed/);
  assert.match(fields, /task_submitted/);
  assert.match(fields, /Time \(SAST\)/);
});
