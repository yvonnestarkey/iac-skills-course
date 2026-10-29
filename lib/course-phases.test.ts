import assert from "node:assert/strict";
import test from "node:test";
import { activityColumnsFromOutline, activityHeaderGroups } from "./activity-grid";
import {
  courseHasNamedPhases,
  splitCoursePhases,
  type CoursePhase,
} from "./course-phases";
import type { OutlineChapter } from "./student-lesson";

function chapter(id: string, title: string, lessonIds: string[] = [`${id}-l1`]): OutlineChapter {
  return {
    id,
    title,
    lessons: lessonIds.map((lessonId) => ({ id: lessonId, title: lessonId, type: "video" })),
  };
}

test("IAC Skills keeps Phase 1 Strategy and Phase 2 Tasks", () => {
  const chapters = [
    chapter("ch3", "S1 - Welcome! How does this course work?"),
    chapter("ch5", "S2 - What does SAICA want you to focus on?"),
    chapter("ch10", "Task 1 - How to evaluate whether you need revision"),
    chapter("ch12", "Task 2 - Planning your Case Study"),
  ];
  assert.equal(courseHasNamedPhases(chapters), true);
  const phases = splitCoursePhases(chapters);
  assert.deepEqual(
    phases.map((phase: CoursePhase) => ({ id: phase.id, title: phase.title, chapters: phase.chapters.map((row) => row.id) })),
    [
      {
        id: "phase1",
        title: "Phase 1: Strategy & Study Methodologies",
        chapters: ["ch3", "ch5"],
      },
      {
        id: "phase2",
        title: "Phase 2: Tasks & Tools",
        chapters: ["ch10", "ch12"],
      },
    ]
  );
});

test("Teaching Mindset chapters stay as chapters and do not invent IAC phases", () => {
  const chapters = [
    chapter("teaching-mindset-skills-ch1", "Introduction to Mindset & Skills Coaching"),
    chapter("teaching-mindset-skills-ch2", "Awareness: Elements"),
    chapter("teaching-mindset-skills-ch3", "Awareness: My Student Coaching"),
    chapter("teaching-mindset-skills-ch4", "Related Research in Accounting Education"),
    chapter("teaching-mindset-skills-ch5", "Awareness: Challenges"),
    chapter("teaching-mindset-skills-ch6", "Awareness: The Mindset Meaning System"),
    chapter("teaching-mindset-skills-ch7", "Action"),
    chapter("teaching-mindset-skills-ch8", "Accountability"),
    chapter("teaching-mindset-skills-ch9", "Objective"),
  ];
  assert.equal(courseHasNamedPhases(chapters), false);
  const phases = splitCoursePhases(chapters);
  assert.equal(phases.length, 1);
  assert.equal(phases[0].title, "");
  assert.equal(phases[0].unit, "Chapters");
  assert.deepEqual(
    phases[0].chapters.map((row) => row.title),
    chapters.map((row) => row.title)
  );
  assert.equal(
    phases.some((phase) => /Phase 1|Phase 2|Strategy & Study|Tasks & Tools/.test(phase.title)),
    false
  );
});

test("activity grid omits Phase labels when a course has no S# or Task chapters", () => {
  const columns = activityColumnsFromOutline([
    chapter("ch1", "Introduction to Mindset & Skills Coaching", ["a", "b"]),
    chapter("ch2", "Awareness: Elements", ["c"]),
  ]);
  assert.equal(columns.every((column) => column.phaseLabel === ""), true);
  const groups = activityHeaderGroups(columns);
  assert.equal(groups.phases.every((phase) => phase.label === ""), true);
  assert.deepEqual(
    groups.chapters.map((row) => row.title),
    ["Introduction to Mindset & Skills Coaching", "Awareness: Elements"]
  );
});
