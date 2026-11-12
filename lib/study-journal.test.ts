import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  daysUntilExam,
  emptyJournalPrivacy,
  emptyJournalWeek,
  journalDayFilled,
  journalMood,
  journalWeekDates,
  journalWeekFilled,
  journalWeekStart,
  questionsByExamDate,
  shiftJournalWeek,
  submittedTaskCount,
  weekFromRow,
  weekWriteRow,
} from "./study-journal";

test("journal weeks are Monday to Sunday", () => {
  assert.equal(journalWeekStart("2026-11-12"), "2026-11-09");
  assert.deepEqual(journalWeekDates("2026-11-09"), [
    "2026-11-09",
    "2026-11-10",
    "2026-11-11",
    "2026-11-12",
    "2026-11-13",
    "2026-11-14",
    "2026-11-15",
  ]);
  assert.equal(shiftJournalWeek("2026-11-09", 1), "2026-11-16");
  assert.equal(journalWeekDates("2026-11-09").length, 7);
});

test("countdown and question projection use the exam date", () => {
  assert.equal(daysUntilExam("2026-11-19", "2026-11-12"), 7);
  assert.equal(questionsByExamDate(10, "2026-11-19", "2026-11-12"), 10);
  assert.equal(questionsByExamDate(10, null, "2026-11-12"), null);
  assert.equal(journalMood("overwhelmed")?.emoji, "😭");
});

test("weeks round-trip seven day cards and keep the exam date", () => {
  const saved = weekWriteRow(
    emptyJournalWeek("2026-11-09", {
      examOn: "2026-12-01",
      questionsPerWeek: 8,
      days: { "2026-11-09": { studied: "yes", studiedWhat: "Task 2", stuckToPlan: "yes", mood: "good", note: "Keep going" } },
    })
  );
  const mapped = weekFromRow({ ...saved, week_start: saved.week_start });
  assert.equal(mapped.examOn, "2026-12-01");
  assert.equal(mapped.days["2026-11-09"]?.mood, "good");
  assert.equal(mapped.days["2026-11-15"]?.studied, "");
  assert.equal(Object.keys(mapped.days).length, 7);
});

test("task submitted counts only live tasks with a submission", () => {
  assert.deepEqual(
    submittedTaskCount(
      [
        { chapterId: "ch10", assignmentLessonId: "t1" },
        { chapterId: "ch11", assignmentLessonId: "t2" },
        { chapterId: null, assignmentLessonId: "missing" },
      ],
      { t1: { body: "done" }, t2: { body: "" } }
    ),
    { done: 1, total: 2 }
  );
});

test("study journal sits on the dashboard and above Study Clinic in the sidebar", () => {
  const dash = readFileSync(resolve("components/student/StudentDashboard.tsx"), "utf8");
  const nav = readFileSync(resolve("components/student/StudentCourseNav.tsx"), "utf8");
  const page = readFileSync(resolve("app/student/journal/page.tsx"), "utf8");
  const journal = readFileSync(resolve("components/student/StudentStudyJournal.tsx"), "utf8");
  const progress = readFileSync(resolve("components/student/StudentCourseProgress.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/student-study-journal.sql"), "utf8");
  assert.match(dash, /StudentStudyJournal/);
  assert.match(page, /StudentStudyJournal/);
  assert.match(journal, /How did today go\?/);
  assert.match(journal, /JOURNAL_WEEKDAYS/);
  assert.match(progress, /task\$\{tasks.total === 1 \? "" : "s"\} submitted/);
  assert.match(progress, /watched to 80%/);
  assert.match(sql, /create table if not exists public\.student_study_journal/);
  const journalAt = nav.indexOf("Study Journal");
  const clinicAt = nav.indexOf("Study Clinic");
  assert.ok(journalAt >= 0 && clinicAt > journalAt);
});

test("the study journal is visible to Yvonne until the student opts out", () => {
  assert.deepEqual(emptyJournalPrivacy(), { private: false, promptSeen: false });
  assert.equal(journalDayFilled(emptyJournalWeek("2026-11-09").days["2026-11-09"]), false);
  assert.equal(
    journalWeekFilled(
      emptyJournalWeek("2026-11-09", { days: { "2026-11-09": { studied: "yes", studiedWhat: "", stuckToPlan: "", mood: "", note: "" } } })
    ),
    true
  );
  const journal = readFileSync(resolve("components/student/StudentStudyJournal.tsx"), "utf8");
  const sql = readFileSync(resolve("supabase/student-study-journal.sql"), "utf8");
  const profile = readFileSync(resolve("components/coach/StudentProfile.tsx"), "utf8");
  const panel = readFileSync(resolve("components/coach/CoachStudyJournalPanel.tsx"), "utf8");
  assert.match(journal, /Yvonne can see your planner/);
  assert.match(journal, /Click here/);
  assert.match(journal, /keep this private so only you can see it/);
  assert.match(sql, /student_study_journal_settings/);
  assert.match(sql, /staff read shared study journals/);
  assert.match(sql, /s\.private = true/);
  assert.match(profile, /CoachStudyJournalPanel/);
  assert.match(panel, /kept their study journal private/);
});
