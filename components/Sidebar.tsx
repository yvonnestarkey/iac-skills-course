"use client";

import { usePathname, useRouter } from "next/navigation";
import CoursePhaseAccordions from "@/components/course/CoursePhaseAccordions";
import { asCompletedMap } from "@/lib/course-phases";
import { progressFor } from "@/lib/course";
import { longDate } from "@/lib/dates";
import { planStatus } from "@/lib/planner";
import { useStore } from "@/lib/store";
import { useStudentNav } from "@/lib/student-nav";
import type { OutlineChapter } from "@/lib/student-lesson";

export default function Sidebar() {
  const { data, student, setNotice } = useStore();
  const courseNav = useStudentNav();
  const pathname = usePathname();
  const router = useRouter();

  if (!student) return null;
  const onPlanner = pathname === "/planner";
  const p = progressFor(data, student);
  const plan = student.plan;
  const status = plan ? planStatus(data, student) : null;
  let planLine = "Tell us when you can study and we will date the whole course for you.";
  if (plan && status) {
    planLine = `${plan.hours} h a week · ${plan.slots.length} session${plan.slots.length === 1 ? "" : "s"}`;
    planLine += status.finish ? ` · finishes ${longDate(status.finish)}` : " · course complete";
    if (status.overdue.length) planLine += ` · ${status.overdue.length} behind`;
  }

  const activeLessonId = pathname.startsWith("/learn/") ? pathname.split("/")[2] : null;
  const completed = asCompletedMap(student.completed);
  const chapters: OutlineChapter[] = data.chapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    summary: chapter.summary,
    lessons: chapter.lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      type: lesson.type,
      duration: lesson.duration,
    })),
  }));

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
        <button
          type="button"
          onClick={() => {
            setNotice("");
            courseNav?.setOpen(false);
            router.push("/planner");
          }}
        >
          {plan ? "Update My Study Plan" : "Create My Study Plan"}
        </button>
      </div>
      <CoursePhaseAccordions
        chapters={chapters}
        completed={completed}
        activeLessonId={activeLessonId}
        basePath="/learn"
        onNavigate={() => {
          setNotice("");
          courseNav?.setOpen(false);
        }}
        variant="nav"
      />
    </>
  );
}
