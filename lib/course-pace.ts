import { addDays, isoDate, isoToSastDateAndTime, parseISO } from "./dates";
import { lessonMinutes, type DurationFields } from "./lesson-duration";
import { getSupabase } from "./supabase";
import { fetchStudentRegisteredOn } from "./student-task-due-dates";

const LONG_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export type CoursePaceEstimate = {
  date: string | null;
  message: string;
};

export function addCalendarDays(iso: string, days: number): string {
  return isoDate(addDays(parseISO(iso), days));
}

export function calendarDaysBetween(from: string, to: string): number {
  const start = parseISO(from);
  const end = parseISO(to);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

export function formatCourseFinishDate(iso: string): string {
  const date = parseISO(iso);
  return `${date.getDate()} ${LONG_MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export function courseStudyMinutes(
  lessons: Array<DurationFields & { id: string }>,
  completed: Record<string, boolean> | null | undefined
): { total: number; done: number } {
  return (lessons || []).reduce(
    (sum, lesson) => {
      const minutes = lessonMinutes(lesson);
      return {
        total: sum.total + minutes,
        done: sum.done + (completed?.[lesson.id] ? minutes : 0),
      };
    },
    { total: 0, done: 0 }
  );
}

export function estimateCourseFinish(input: {
  today: string;
  startedOn: string | null;
  totalMinutes: number;
  doneMinutes: number;
}): CoursePaceEstimate {
  const today = String(input.today || "").slice(0, 10);
  const total = Math.max(0, input.totalMinutes);
  const done = Math.max(0, Math.min(total, input.doneMinutes));
  if (!today || !total) return { date: null, message: "" };
  if (done >= total) {
    return { date: today, message: "You've completed the course." };
  }
  if (done <= 0 || !input.startedOn) {
    return { date: null, message: "Complete your first lesson to see an estimated finish date." };
  }

  const elapsedDays = Math.max(1, calendarDaysBetween(input.startedOn, today));
  const remainingMinutes = total - done;
  const remainingDays = Math.min(800, Math.max(1, Math.round(remainingMinutes / (done / elapsedDays))));
  const date = addCalendarDays(today, remainingDays);
  return {
    date,
    message: `At your current pace, you'll complete the course on ${formatCourseFinishDate(date)}.`,
  };
}

export async function fetchStudentStartedOn(studentId: string): Promise<string | null> {
  const client = getSupabase();
  if (!client) return fetchStudentRegisteredOn(studentId);
  const progress = await client
    .from("lesson_progress")
    .select("opened_at, last_opened_at, updated_at")
    .eq("user_id", studentId);
  const stamps = (progress.data || [])
    .flatMap((row) => [row.opened_at, row.updated_at])
    .map((value) => isoToSastDateAndTime(String(value || "")).date)
    .filter(Boolean)
    .sort();
  return stamps[0] || fetchStudentRegisteredOn(studentId);
}
