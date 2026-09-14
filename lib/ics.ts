import { longDate, today } from "./dates";
import type { Student } from "./types";

export {
  COURSE_RESUME_URL,
  STUDY_SESSION_TITLE,
  icsEscape,
  icsFold,
  icsStamp,
  siteOrigin,
  courseResumeLink,
  lessonLink,
  collectTimedLessons,
  groupLessonsByDate,
  buildStudySessionEvents,
  googleCalendarEventUrl,
  buildIcs,
  countEvents,
  countStudySessionEvents,
  type CalendarEventPayload,
} from "./calendarSync";

export function feedToken(student: Student): string {
  if (student.calendar && student.calendar.token) return student.calendar.token;
  const random = Math.random().toString(36).slice(2, 10);
  return `${student.id}-${random}`;
}

export function feedUrls(token: string, origin = typeof window === "undefined" ? "" : window.location.origin) {
  const base = `${origin}/api/calendar/${token}.ics`;
  const webcal = base.replace(/^https?:/, "webcal:");
  return {
    http: base,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
  };
}

export function feedStamp(): string {
  return `${longDate(today())}, ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}
