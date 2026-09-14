"use client";

import LessonTypeIcon from "@/components/lesson/LessonTypeIcon";
import { chapterCode, isDone, taskAction } from "@/lib/course";
import { addDays, isoDate, longDate, mondayOf, parseISO, shortDate, today } from "@/lib/dates";
import { planCapacity, planStatus, upcomingLiveSessions } from "@/lib/planner";
import { useStore } from "@/lib/store";
import type { CourseData, ScheduledSession, Student, StudyPlan } from "@/lib/types";

interface Entry {
  kind: "study" | "live";
  date: Date;
  period: string;
  cell?: ScheduledSession;
  live?: { title: string; time: string; minutes: number; zoom: string };
}

function weekGroups(data: CourseData, cells: ScheduledSession[]) {
  const live = upcomingLiveSessions(data);
  const entries: Entry[] = [
    ...cells.map((c) => ({ kind: "study" as const, date: c.date, period: c.period, cell: c })),
    ...live.map((s) => ({ kind: "live" as const, date: s.when, period: "evening", live: s })),
  ].sort((a, b) => {
    const order = ["morning", "afternoon", "evening"];
    return a.date.getTime() - b.date.getTime() || order.indexOf(a.period) - order.indexOf(b.period);
  });

  const groups: Array<{ key: string; monday: Date; entries: Entry[] }> = [];
  entries.forEach((entry) => {
    const key = isoDate(mondayOf(entry.date));
    let group = groups.find((g) => g.key === key);
    if (!group) {
      group = { key, monday: mondayOf(entry.date), entries: [] };
      groups.push(group);
    }
    group.entries.push(entry);
  });
  return groups;
}

export default function ScheduleView({
  student,
  draft,
  data: courseOverride,
}: {
  student: Student;
  draft: StudyPlan;
  data?: CourseData;
}) {
  const store = useStore();
  const data = courseOverride || store.data;

  if (!draft.slots.length) {
    return (
      <div className="card plan-empty">
        <p className="empty">Pick at least one session above and your dated schedule will appear here.</p>
      </div>
    );
  }

  const status = planStatus(data, student, draft);
  const cells = status ? status.cells : [];
  if (!cells.length) {
    return (
      <div className="card plan-empty">
        <h3>Nothing left to schedule</h3>
        <p>Every lesson, assignment, and upload on the course is complete.</p>
      </div>
    );
  }

  const start = parseISO(draft.startDate);
  const now = today();
  const groups = weekGroups(data, cells);
  const hours = Math.max(0.5, Number(draft.hours) || 1);

  return (
    <>
      {status.overdue.length ? (
        <div className="plan-behind">
          You are{" "}
          <strong>
            {status.overdue.length} item{status.overdue.length === 1 ? "" : "s"}
          </strong>{" "}
          behind this plan. Use <em>Adjust me</em> to add make-up sessions or move your start date.
        </div>
      ) : null}
      <div className="plan-summary">
        {status.finish ? (
          <>
            At {hours} hours a week you finish the whole course on <strong>{longDate(status.finish)}</strong> —{" "}
            {groups.length} week{groups.length === 1 ? "" : "s"} from {longDate(start)}.{" "}
          </>
        ) : null}
        Sessions are capped at {planCapacity(draft)} minutes each so nothing overruns.
      </div>
      {groups.map((group, index) => (
        <section className="card plan-week" key={group.key}>
          <div className="plan-week-head">
            <h3>Week {index + 1}</h3>
            <span className="muted small">
              {shortDate(group.monday)} – {shortDate(addDays(group.monday, 6))}
            </span>
          </div>
          {group.entries.map((entry, i) => {
            if (entry.kind === "live") {
              return (
                <div className="plan-row live" key={`live-${i}`}>
                  <div className="plan-slot">
                    <strong>{longDate(entry.date)}</strong>
                    <span className="muted small">{entry.live.time} · live on Zoom</span>
                  </div>
                  <ul className="plan-items">
                    <li>
                      <span className="plan-icon live">◉</span>
                      <span className="plan-item-text">
                        <strong>{entry.live.title}</strong>
                        <span className="muted small">
                          {entry.live.minutes} min ·{" "}
                          <a href={entry.live.zoom} target="_blank" rel="noopener">
                            Join Zoom
                          </a>
                        </span>
                      </span>
                    </li>
                  </ul>
                </div>
              );
            }
            const cell = entry.cell;
            const past = cell.date < now;
            return (
              <div className={`plan-row ${past ? "past" : ""}`} key={`study-${i}`}>
                <div className="plan-slot">
                  <strong>{longDate(cell.date)}</strong>
                  <span className="muted small">
                    {cell.period}
                    {cell.makeup ? " · make-up" : ""} · {cell.used} of {cell.capacity} min
                  </span>
                </div>
                <ul className="plan-items">
                  {cell.items.map((item, j) => {
                    const done = isDone(student, item.lesson);
                    const late = past && !done;
                    return (
                      <li className={`${done ? "done" : ""} ${late ? "late" : ""}`} key={j}>
                        <span className={`plan-icon ${item.lesson.type}`}>
                          {done ? (
                            "✓"
                          ) : (
                            <LessonTypeIcon type={item.lesson.type} title={item.lesson.title} size={13} />
                          )}
                        </span>
                        <span className="plan-item-text">
                          <strong>
                            {item.lesson.title}
                            {item.parts ? ` — part ${item.part} of ${item.parts}` : ""}
                          </strong>
                          <span className="muted small">
                            {chapterCode(item.lesson.chapter)} · {taskAction(item.lesson)} · {item.minutes} min
                            {late ? " · missed" : ""}
                          </span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </section>
      ))}
      <p className="muted small plan-note">
        Ask the Coach is not scheduled — it stays open whenever you get stuck. Live Zoom sessions are shown in
        place. Lesson lengths come from the course catalogue.
      </p>
    </>
  );
}
