import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { JOURNAL_NEEDS } from "./study-journal";
import {
  applyJournalNeedChange,
  groupCoachJournalNeeds,
  isOpenJournalNeed,
  journalNeedToSaveAfterContact,
  mergeOpenJournalNeeds,
  type JournalNeedEvent,
} from "./journal-needs";

function event(overrides: Partial<JournalNeedEvent> = {}): JournalNeedEvent {
  return {
    id: "e1",
    userId: "11111111-1111-4111-8111-111111111111",
    weekStart: "2026-11-09",
    needId: "encouragement",
    needOther: "",
    selectedAt: "2026-11-10T08:00:00.000Z",
    clearedAt: null,
    contactedAt: null,
    ...overrides,
  };
}

test("journal need changes keep one open selection per week and store the rest as history", () => {
  const open = [event()];
  const same = applyJournalNeedChange(open, "encouragement");
  assert.equal(same.insert, false);
  assert.equal(same.keepId, "e1");
  const switched = applyJournalNeedChange(open, "hope");
  assert.equal(switched.insert, true);
  assert.deepEqual(switched.clearIds, ["e1"]);
  const cleared = applyJournalNeedChange(open, "");
  assert.equal(cleared.insert, false);
  assert.deepEqual(cleared.clearIds, ["e1"]);
  assert.equal(isOpenJournalNeed(event({ contactedAt: "2026-11-11T08:00:00.000Z" })), false);
});

test("coach need alerts list every option and hide contacted or private students", () => {
  const amina = "11111111-1111-4111-8111-111111111111";
  const thabo = "22222222-2222-4222-8222-222222222222";
  const privateId = "33333333-3333-4333-8333-333333333333";
  const open = mergeOpenJournalNeeds(
    [
      event({ id: "open", userId: amina, needId: "hope" }),
      event({ id: "done", userId: thabo, needId: "accountability", contactedAt: "2026-11-11T08:00:00.000Z" }),
      event({ id: "hidden", userId: privateId, needId: "encouragement" }),
    ],
    [{ userId: thabo, weekStart: "2026-11-09", needId: "accountability", needOther: "", updatedAt: "2026-11-10T08:00:00.000Z" }],
    new Set([privateId])
  );
  const groups = groupCoachJournalNeeds(open, { [amina]: "Amina", [thabo]: "Thabo" });
  assert.deepEqual(
    groups.map((group) => group.id),
    JOURNAL_NEEDS.map((option) => option.id)
  );
  assert.equal(groups.find((group) => group.id === "hope")?.alerts[0]?.studentName, "Amina");
  assert.equal(groups.find((group) => group.id === "accountability")?.alerts.length, 0);
  assert.equal(groups.find((group) => group.id === "encouragement")?.alerts.length, 0);
  assert.equal(groups.find((group) => group.id === "nothing")?.alerts.length, 0);
});

test("contacted needs leave the journal empty so the student has to choose again", () => {
  const restored = journalNeedToSaveAfterContact({
    loadedNeed: "reality_check",
    loadedOther: "",
    draftNeed: "reality_check",
    draftOther: "",
    storedNeed: "",
    storedOther: "",
  });
  assert.deepEqual(restored, { weekNeed: "", weekNeedOther: "" });
  const reselected = journalNeedToSaveAfterContact({
    loadedNeed: "",
    loadedOther: "",
    draftNeed: "reality_check",
    draftOther: "",
    storedNeed: "",
    storedOther: "",
  });
  assert.deepEqual(reselected, { weekNeed: "reality_check", weekNeedOther: "" });
});

test("journal needs sit on the coach dashboard and keep an audit trail on the student profile", () => {
  const dash = readFileSync(resolve("components/coach/CoachHomeDashboard.tsx"), "utf8");
  const block = readFileSync(resolve("components/coach/CoachJournalNeeds.tsx"), "utf8");
  const panel = readFileSync(resolve("components/coach/CoachStudyJournalPanel.tsx"), "utf8");
  const journal = readFileSync(resolve("components/student/StudentStudyJournal.tsx"), "utf8");
  const save = readFileSync(resolve("lib/study-journal.ts"), "utf8");
  const needs = readFileSync(resolve("lib/journal-needs.ts"), "utf8");
  const sql = readFileSync(resolve("supabase/student-journal-needs.sql"), "utf8");
  const reset = readFileSync(resolve("supabase/journal-need-reset.sql"), "utf8");
  assert.match(dash, /CoachJournalNeeds/);
  assert.match(block, /What they need/);
  assert.match(block, /Contacted/);
  assert.match(block, /Message/);
  assert.match(block, /reset their/);
  assert.match(block, /group\.label/);
  assert.match(panel, /Needs history/);
  assert.match(panel, /fetchCoachJournalNeedAudit/);
  assert.match(journal, /choose again if you still need this/);
  assert.match(save, /recordJournalNeedChange/);
  assert.match(needs, /resetStudentJournalNeed/);
  assert.match(needs, /week_need: ""/);
  assert.match(sql, /student_journal_need_events/);
  assert.match(sql, /contacted_at/);
  assert.match(reset, /staff reset study journal needs/);
});
