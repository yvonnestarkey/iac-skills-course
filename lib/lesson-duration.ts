import type { Lesson, LessonType } from "./types";

export interface DurationFields {
  type?: LessonType | string;
  duration?: string | null;
  seconds?: number | null;
  video_duration_seconds?: number | null;
  estimated_read_minutes?: number | null;
  duration_minutes?: number | null;
}

const TYPE_DEFAULTS: Record<string, number> = {
  video: 10,
  reading: 5,
  assignment: 60,
  upload: 40,
  survey: 5,
  ask: 10,
};

function asPositive(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Parse "8:24", "12 min", "6 min read", or a bare number of minutes. */
export function parseDurationText(value: string | null | undefined): number | null {
  if (!value) return null;
  const text = value.trim();
  if (!text) return null;
  const clock = text.match(/^(\d+):([0-5]\d)(?::([0-5]\d))?/);
  if (clock) {
    const first = Number(clock[1]);
    const second = Number(clock[2]);
    const third = clock[3] ? Number(clock[3]) : null;
    const seconds = third !== null ? first * 3600 + second * 60 + third : first * 60 + second;
    return Math.max(1, Math.ceil(seconds / 60));
  }
  const minutes = text.match(/(\d+(?:\.\d+)?)/);
  if (!minutes) return null;
  const n = Number(minutes[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.max(1, Math.round(n));
}

export function defaultMinutesForType(type?: string): number {
  return TYPE_DEFAULTS[type || ""] || 10;
}

/** Study minutes for a lesson, preferring stored metadata over type defaults. */
export function lessonMinutes(lesson: DurationFields): number {
  const stored = asPositive(lesson.duration_minutes);
  if (stored) return Math.round(stored);
  const videoSeconds = asPositive(lesson.video_duration_seconds) || asPositive(lesson.seconds);
  if (videoSeconds) return Math.max(1, Math.ceil(videoSeconds / 60));
  const read = asPositive(lesson.estimated_read_minutes);
  if (read) return Math.round(read);
  const parsed = parseDurationText(lesson.duration || undefined);
  if (parsed) return parsed;
  return defaultMinutesForType(lesson.type);
}

export function formatMinutesLabel(minutes: number): string {
  return minutes === 1 ? "1 min" : `${minutes} mins`;
}

export function durationBadge(lesson: DurationFields): string {
  const minutes = lessonMinutes(lesson);
  if (lesson.type === "reading") return `${formatMinutesLabel(minutes)} read`;
  return formatMinutesLabel(minutes);
}

export function formatStudyTime(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (!hours) return formatMinutesLabel(rest || 0);
  if (!rest) return `${hours} h`;
  return `${hours} h ${formatMinutesLabel(rest)}`;
}

export function withComputedDuration<T extends DurationFields>(lesson: T): T & Pick<Lesson, "duration_minutes" | "seconds"> {
  const minutes = lessonMinutes(lesson);
  return {
    ...lesson,
    duration_minutes: minutes,
    seconds: asPositive(lesson.seconds) || asPositive(lesson.video_duration_seconds) || minutes * 60,
  };
}
