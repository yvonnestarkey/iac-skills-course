import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { courseTasks } from "./course";
import { lessonMinutes } from "./lesson-duration";
import { packCourse, weeksForPlan } from "./planner";
import { courseDataFromOutline } from "./student-lesson";
import type { OutlineChapter } from "./student-lesson";
import type { StudyPlan } from "./types";

const plan: StudyPlan = {
  startDate: "2026-10-05",
  hours: 5,
  slots: ["tue-evening", "thu-evening", "sat-morning"],
  makeups: [],
};

test("weeksForPlan is the actual course minutes divided by weekly hours", () => {
  assert.equal(weeksForPlan(plan, 15 * 60), 3);
  assert.equal(weeksForPlan(plan, 5 * 60), 1);
  assert.equal(weeksForPlan(plan, 5 * 60 + 1), 2);
  assert.equal(weeksForPlan({ ...plan, hours: 10 }, 15 * 60), 2);
});

test("planner uses lessons.duration_minutes from the course table", () => {
  assert.equal(
    lessonMinutes({
      type: "video",
      duration_minutes: 10,
      video_duration_seconds: 296,
      seconds: 296,
    }),
    10
  );
  assert.equal(lessonMinutes({ type: "assignment", duration_minutes: 90 }), 90);
});

test("packCourse finish date matches the packed lessons, not a padded horizon", () => {
  const outline: OutlineChapter[] = [
    {
      id: "ch-test",
      title: "Chapter",
      lessons: [
        { id: "a", title: "A", type: "video", duration_minutes: 60 },
        { id: "b", title: "B", type: "video", duration_minutes: 60 },
        { id: "c", title: "C", type: "reading", duration_minutes: 60 },
      ],
    },
  ];
  const data = courseDataFromOutline(outline);
  assert.equal(data.liveSessions.length, 0);
  const tasks = courseTasks(data);
  assert.equal(
    tasks.reduce((sum, task) => sum + task.minutes, 0),
    180
  );
  const packed = packCourse(tasks, plan);
  assert.equal(packed.unplaced, 0);
  assert.ok(packed.sessions.length);
  const start = new Date(2026, 9, 5);
  const finish = packed.sessions[packed.sessions.length - 1].date;
  const days = Math.round((finish.getTime() - start.getTime()) / 86400000);
  assert.ok(days <= 14, `finish stretched beyond the actual 3 hours of course: ${days} days`);
});

test("study planner reloads the live course outline so duration_minutes changes apply", () => {
  const planner = readFileSync(resolve("components/student/StudyPlanner.tsx"), "utf8");
  const session = readFileSync(resolve("lib/student-session.tsx"), "utf8");
  const feed = readFileSync(resolve("lib/calendar-feed.ts"), "utf8");
  const fetch = readFileSync(resolve("lib/student-lesson.ts"), "utf8");
  const minutes = readFileSync(resolve("lib/lesson-duration.ts"), "utf8");
  assert.match(planner, /reloadOutline/);
  assert.match(session, /fetchCourseOutline\(\{ fresh: true \}\)/);
  assert.match(feed, /fetchCourseOutline\(\{ fresh: true \}\)/);
  assert.match(fetch, /options\?\.fresh/);
  assert.match(minutes, /const stored = asPositive\(lesson.duration_minutes\)/);
});
