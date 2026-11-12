import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { sastDateAndTimeToIso } from "./dates";
import {
  dueOnInDays,
  reminderDueLabel,
  reminderFromRow,
  reminderWriteRow,
  sortCoachReminders,
  type CoachReminder,
} from "./coach-reminders";

function reminder(overrides: Partial<CoachReminder> = {}): CoachReminder {
  return {
    id: "r1",
    body: "Check in",
    dueOn: "2026-11-19",
    done: false,
    studentIds: ["s1"],
    createdAt: "2026-11-12T08:00:00.000Z",
    updatedAt: "2026-11-12T08:00:00.000Z",
    ...overrides,
  };
}

test("reminders need a note and keep linked students", () => {
  assert.equal(reminderWriteRow({ body: "  ", dueOn: null, studentIds: [] }).ok, false);
  const saved = reminderWriteRow({ body: "Follow up on Task 2", dueOn: "2026-11-19", studentIds: ["s1", "s1", ""] });
  assert.equal(saved.ok, true);
  if (!saved.ok) return;
  assert.equal(saved.row.body, "Follow up on Task 2");
  assert.equal(saved.row.due_on, "2026-11-19");
  assert.deepEqual(saved.row.student_ids, ["s1"]);
});

test("open reminders sort overdue, today, then later, and done last", () => {
  const now = new Date(sastDateAndTimeToIso("2026-11-12", "10:00") || "");
  const ordered = sortCoachReminders(
    [
      reminder({ id: "later", dueOn: "2026-11-20" }),
      reminder({ id: "done", dueOn: "2026-11-01", done: true }),
      reminder({ id: "today", dueOn: "2026-11-12" }),
      reminder({ id: "overdue", dueOn: "2026-11-05" }),
      reminder({ id: "undated", dueOn: null }),
    ],
    now
  );
  assert.deepEqual(
    ordered.map((item) => item.id),
    ["overdue", "today", "later", "undated", "done"]
  );
  assert.equal(reminderDueLabel(reminder({ dueOn: "2026-11-12" }), now), "today");
  assert.equal(reminderDueLabel(reminder({ dueOn: "2026-11-05" }), now), "overdue");
});

test("in a week is seven SAST calendar days from today", () => {
  const now = new Date(sastDateAndTimeToIso("2026-11-12", "22:00") || "");
  assert.equal(dueOnInDays(7, now), "2026-11-19");
});

test("rows map onto reminders and the SQL stays pasteable", () => {
  const mapped = reminderFromRow({
    id: "row-1",
    body: "Call Thandi",
    due_on: "2026-11-20",
    done: false,
    student_ids: ["11111111-1111-4111-8111-111111111111"],
    created_at: "2026-11-12T08:00:00.000Z",
    updated_at: "2026-11-12T08:00:00.000Z",
  });
  assert.equal(mapped.body, "Call Thandi");
  assert.equal(mapped.studentIds.length, 1);
  const sql = readFileSync(resolve("supabase/coach-reminders.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.coach_reminders/);
  assert.match(sql, /student_ids uuid\[\]/);
});
