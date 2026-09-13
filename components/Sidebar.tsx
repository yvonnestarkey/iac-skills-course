"use client";

import { usePathname, useRouter } from "next/navigation";
import { ICONS } from "@/lib/constants";
import { fileFor, progressFor, surveyFor, textFor, unansweredQuestion } from "@/lib/course";
import { longDate } from "@/lib/dates";
import { planStatus } from "@/lib/planner";
import { useStore } from "@/lib/store";
import { useStudentNav } from "@/lib/student-nav";
import type { Lesson } from "@/lib/types";

export default function Sidebar() {
  const { data, student, setNotice } = useStore();
  const courseNav = useStudentNav();
  const pathname = usePathname();
  const router = useRouter();
  if (!student) return null;

  const activeLessonId = pathname.startsWith("/learn/") ? pathname.split("/")[2] : null;
  const onPlanner = pathname === "/planner";
  const p = progressFor(data, student);

  const metaFor = (lesson: Lesson) => {
    if (lesson.type === "assignment") return textFor(student, lesson.id).trim() ? "Submitted" : "Not submitted";
    if (lesson.type === "upload") return fileFor(student, lesson.id) ? "PDF uploaded" : "No PDF yet";
    if (lesson.type === "ask") return unansweredQuestion(data, student.id) ? "Waiting for coach" : "Open a question";
    if (lesson.type === "survey") return surveyFor(student, lesson.id) ? "Feedback sent" : "Give feedback";
    return lesson.duration || "";
  };

  const plan = student.plan;
  const status = plan ? planStatus(data, student) : null;
  let planLine = "Tell us when you can study and we will date the whole course for you.";
  if (plan && status) {
    planLine = `${plan.hours} h a week · ${plan.slots.length} session${plan.slots.length === 1 ? "" : "s"}`;
    planLine += status.finish ? ` · finishes ${longDate(status.finish)}` : " · course complete";
    if (status.overdue.length) planLine += ` · ${status.overdue.length} behind`;
  }

  const go = (href: string) => {
    setNotice("");
    courseNav?.setOpen(false);
    router.push(href);
  };

  return (
    <>
      <div className="course-head">
        <h2>Course modules</h2>
        <p className="muted">
          {data.className} · {data.term}
        </p>
        <div className="bar">
          <span style={{ width: `${p.pct}%` }} />
        </div>
        <p className="muted small">
          {p.done} of {p.total} lessons complete
        </p>
      </div>
      <div className={`plan-card ${onPlanner ? "active" : ""} ${status && status.overdue.length ? "warn" : ""}`}>
        <strong>Personalised study planner</strong>
        <p>{planLine}</p>
        <button onClick={() => go("/planner")}>{plan ? "Update My Study Plan" : "Create My Study Plan"}</button>
      </div>
      {data.chapters.map((chapter) => (
        <section className="chapter" key={chapter.id}>
          <h3>{chapter.title}</h3>
          <p className="chapter-summary">{chapter.summary}</p>
          {chapter.lessons.map((lesson) => {
            const active = lesson.id === activeLessonId;
            const done = (student.completed || []).includes(lesson.id);
            return (
              <button
                key={lesson.id}
                className={`lesson-link ${active ? "active" : ""} ${lesson.type}`}
                onClick={() => go(`/learn/${lesson.id}`)}
              >
                <span className="icon">{done ? "✓" : ICONS[lesson.type]}</span>
                <span className="label">
                  <span className="lesson-title">{lesson.title}</span>
                  <span className="lesson-meta">{metaFor(lesson)}</span>
                </span>
              </button>
            );
          })}
        </section>
      ))}
    </>
  );
}
