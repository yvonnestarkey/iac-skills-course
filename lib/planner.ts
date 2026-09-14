import { DAYS, PERIODS } from "./constants";
import { courseTasks, isDone } from "./course";
import { WEEKDAYS, addDays, parseISO, today } from "./dates";
import type { CourseData, FlatLesson, LiveSession, PlanStatus, ScheduledSession, Student, StudyPlan } from "./types";

export function slotLabel(slotId: string): string {
  const [dayId, periodId] = slotId.split("-");
  const day = DAYS.find((d) => d.id === dayId);
  const period = PERIODS.find((p) => p.id === periodId);
  return `${day ? day.label : dayId} ${period ? period.label : periodId}`;
}

export function sortSlots(slots: string[]): string[] {
  const order = (slotId: string) => {
    const [dayId, periodId] = slotId.split("-");
    return DAYS.findIndex((d) => d.id === dayId) * PERIODS.length + PERIODS.findIndex((p) => p.id === periodId);
  };
  return [...slots].sort((a, b) => order(a) - order(b));
}

export function planCapacity(plan: StudyPlan): number {
  const slots = plan.slots.length || 1;
  const hours = Math.max(0.5, Number(plan.hours) || 1);
  return Math.max(20, Math.floor((hours * 60) / slots));
}

// Every session the plan implies, in date order, including one-off make-ups.
export function planSessions(plan: StudyPlan, weeks: number) {
  const start = parseISO(plan.startDate);
  const capacity = planCapacity(plan);
  const sessions = [];
  sortSlots(plan.slots).forEach((slotId) => {
    const [dayId, period] = slotId.split("-");
    const targetJs = WEEKDAYS.indexOf(DAYS.find((d) => d.id === dayId).label);
    const delta = (targetJs - start.getDay() + 7) % 7;
    for (let w = 0; w < weeks; w += 1) {
      sessions.push({ date: addDays(start, delta + w * 7), period, capacity, slotId });
    }
  });
  (plan.makeups || []).forEach((m) => {
    sessions.push({
      date: parseISO(m.date),
      period: m.period,
      capacity: Math.max(20, Number(m.minutes) || capacity),
      slotId: `${m.date}-${m.period}`,
      makeup: true,
    });
  });
  const rank = (s) => {
    const periodOrder = PERIODS.findIndex((p) => p.id === s.period);
    return s.date.getTime() + (periodOrder >= 0 ? periodOrder : PERIODS.length);
  };
  return sessions.sort((a, b) => rank(a) - rank(b));
}

export function packPlan(tasks, sessions): { sessions: ScheduledSession[]; unplaced: number } {
  const queue = tasks.map((t) => ({ ...t, remaining: t.minutes }));
  const filled = [];

  for (const session of sessions) {
    if (!queue.length) break;
    const cell = { ...session, items: [], used: 0 };
    while (queue.length) {
      const free = cell.capacity - cell.used;
      const task = queue[0];
      if (task.remaining <= free) {
        cell.items.push({ lesson: task.lesson, minutes: task.remaining });
        cell.used += task.remaining;
        queue.shift();
        continue;
      }
      // Split only when both halves are worth sitting down for, or when the
      // session is empty and the task would otherwise never fit.
      if (cell.used === 0 || (free >= 30 && task.remaining - free >= 20)) {
        cell.items.push({ lesson: task.lesson, minutes: free });
        task.remaining -= free;
        cell.used = cell.capacity;
      }
      break;
    }
    if (cell.items.length) filled.push(cell);
  }

  const counts = {};
  filled.forEach((c) =>
    c.items.forEach((i) => {
      counts[i.lesson.id] = (counts[i.lesson.id] || 0) + 1;
    })
  );
  const seen = {};
  filled.forEach((c) =>
    c.items.forEach((item) => {
      if (counts[item.lesson.id] > 1) {
        seen[item.lesson.id] = (seen[item.lesson.id] || 0) + 1;
        item.part = seen[item.lesson.id];
        item.parts = counts[item.lesson.id];
      }
    })
  );

  return { sessions: filled, unplaced: queue.length };
}

export function weeksForPlan(plan: StudyPlan, totalMinutes: number): number {
  const weekly = Math.max(0.5, Number(plan.hours) || 1) * 60;
  return Math.max(2, Math.ceil(Math.max(totalMinutes, 1) / weekly) + 3);
}

export function packCourse(tasks: { lesson: FlatLesson; minutes: number }[], plan: StudyPlan) {
  const totalMinutes = tasks.reduce((sum, task) => sum + task.minutes, 0);
  let weeks = weeksForPlan(plan, totalMinutes);
  let packed = packPlan(tasks, planSessions(plan, weeks));
  while (packed.unplaced && weeks < 104) {
    weeks += 4;
    packed = packPlan(tasks, planSessions(plan, weeks));
  }
  return packed;
}

export function planStatus(data: CourseData, student: Student, planOverride?: StudyPlan): PlanStatus | null {
  const plan = planOverride || student.plan;
  if (!plan || !plan.slots.length) return null;
  const tasks = courseTasks(data);
  const packed = packCourse(tasks, plan);
  const cells = packed.sessions;
  const now = today();
  const overdue = [];
  const seen = {};
  cells.forEach((cell) => {
    if (cell.date >= now) return;
    cell.items.forEach((item) => {
      if (isDone(student, item.lesson) || seen[item.lesson.id]) return;
      seen[item.lesson.id] = true;
      overdue.push({ lesson: item.lesson, date: cell.date });
    });
  });
  const remaining = tasks.filter((t) => !isDone(student, t.lesson)).length;
  return {
    plan,
    cells,
    overdue,
    remaining,
    unplaced: packed.unplaced,
    finish: cells.length ? cells[cells.length - 1].date : null,
  };
}

// Cohort Zoom calls are fixed dates, so they show and export regardless of
// where a student's own plan has got to.
export function upcomingLiveSessions(data: CourseData): Array<LiveSession & { when: Date }> {
  const now = today();
  return (data.liveSessions || [])
    .map((s) => ({ ...s, when: parseISO(s.date) }))
    .filter((s) => s.when >= now)
    .sort((a, b) => a.when.getTime() - b.when.getTime());
}
