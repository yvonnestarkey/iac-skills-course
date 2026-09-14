import { SLOT_TIMES } from "./constants";
import { isoDate } from "./dates";
import { planStatus, upcomingLiveSessions } from "./planner";
import type { CourseData, ScheduledSession, Student, StudyPlan } from "./types";

export const STUDY_SESSION_TITLE = "IAC Study Session";
export const COURSE_RESUME_URL = "https://iac.accountingstudyadvice.com/student/overview";

export interface CalendarEventPayload {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description: string;
  location?: string;
  url?: string;
}

interface TimedLesson {
  dateKey: string;
  date: Date;
  startMinutes: number;
  endMinutes: number;
  title: string;
}

export function icsEscape(value: string): string {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function icsFold(line: string): string {
  if (line.length <= 73) return line;
  const parts = [line.slice(0, 73)];
  let rest = line.slice(73);
  while (rest.length > 72) {
    parts.push(` ${rest.slice(0, 72)}`);
    rest = rest.slice(72);
  }
  if (rest) parts.push(` ${rest}`);
  return parts.join("\r\n");
}

export function icsStamp(date: Date, hours: number, minutes: number): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
}

export function siteOrigin(): string {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function courseResumeLink(_origin = siteOrigin()): string {
  return COURSE_RESUME_URL;
}

export function lessonLink(lessonId: string, origin = siteOrigin()): string {
  return `${origin}/student/${lessonId}`;
}

function slotMinutes(period: string): number {
  const [hours, minutes] = SLOT_TIMES[period] || SLOT_TIMES.evening;
  return hours * 60 + minutes;
}

function stampFromMinutes(date: Date, totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return icsStamp(date, hours, minutes);
}

/**
 * Bucket every packed lesson into eventsByDate[dateKey] first.
 * VEVENT creation must iterate Object.keys(eventsByDate), never the lesson list.
 */
export function groupPackedLessonsByDate(cells: ScheduledSession[]): Record<string, TimedLesson[]> {
  const eventsByDate: Record<string, TimedLesson[]> = {};

  for (const cell of cells) {
    const dateKey = isoDate(cell.date);
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
    let cursor = slotMinutes(cell.period);
    for (const item of cell.items) {
      const duration = Math.max(0, Number(item.minutes) || 0);
      if (!duration) continue;
      eventsByDate[dateKey].push({
        dateKey,
        date: cell.date,
        startMinutes: cursor,
        endMinutes: cursor + duration,
        title: item.lesson.title,
      });
      cursor += duration;
    }
  }

  return eventsByDate;
}

export function collectTimedLessons(cells: ScheduledSession[]): TimedLesson[] {
  return Object.values(groupPackedLessonsByDate(cells)).flat();
}

export function groupLessonsByDate(lessons: TimedLesson[]): TimedLesson[][] {
  const eventsByDate: Record<string, TimedLesson[]> = {};
  for (const lesson of lessons) {
    if (!eventsByDate[lesson.dateKey]) eventsByDate[lesson.dateKey] = [];
    eventsByDate[lesson.dateKey].push(lesson);
  }
  return Object.keys(eventsByDate).map((dateKey) => eventsByDate[dateKey]);
}

function studyEventForDate(dateKey: string, lessons: TimedLesson[], feedId: string): CalendarEventPayload {
  const date = lessons[0].date;
  const startMinutes = Math.min(...lessons.map((lesson) => lesson.startMinutes));
  const endMinutes = Math.max(...lessons.map((lesson) => lesson.endMinutes));
  const titles = lessons.map((lesson) => lesson.title);
  const description =
    "IAC Skills Course Study Session\n\nResume course: " +
    COURSE_RESUME_URL +
    "\n\nScheduled for today:\n• " +
    titles.join("\n• ");

  return {
    uid: `${feedId}-${dateKey}@accountingstudyadvice`,
    start: stampFromMinutes(date, startMinutes),
    end: stampFromMinutes(date, endMinutes),
    summary: STUDY_SESSION_TITLE,
    description,
    location: COURSE_RESUME_URL,
    url: COURSE_RESUME_URL,
  };
}

/** Exactly one study VEVENT per grouped date. Never one VEVENT per lesson. */
export function buildStudySessionEvents(
  data: CourseData,
  student: Student,
  planOverride?: StudyPlan,
  origin = siteOrigin()
): CalendarEventPayload[] {
  const status = planStatus(data, student, planOverride);
  const feedId = (student.calendar && student.calendar.token) || student.id;
  const eventsByDate = groupPackedLessonsByDate(status ? status.cells : []);

  const studyEvents: CalendarEventPayload[] = [];
  for (const dateKey of Object.keys(eventsByDate)) {
    const lessons = eventsByDate[dateKey];
    if (!lessons.length) continue;
    studyEvents.push(studyEventForDate(dateKey, lessons, feedId));
  }

  const liveEvents: CalendarEventPayload[] = [];
  for (const live of upcomingLiveSessions(data)) {
    const [hours, minutes] = live.time.split(":").map(Number);
    const endMinutes = hours * 60 + minutes + live.minutes;
    liveEvents.push({
      uid: `${feedId}-${live.id}@accountingstudyadvice`,
      start: icsStamp(live.when, hours, minutes),
      end: icsStamp(live.when, Math.floor(endMinutes / 60), endMinutes % 60),
      summary: `${data.className} live: ${live.title}`,
      description: [`Live session with ${data.company}.`, `Zoom: ${live.zoom}`, `Course portal: ${courseResumeLink(origin)}`].join(
        "\n"
      ),
      location: live.zoom,
      url: live.zoom,
    });
  }

  return [...studyEvents, ...liveEvents];
}

export function googleCalendarEventUrl(event: CalendarEventPayload): string {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.summary,
    dates: `${event.start}/${event.end}`,
    details: event.description,
  });
  if (event.url) params.set("location", event.url);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildIcs(
  data: CourseData,
  student: Student,
  planOverride?: StudyPlan,
  origin = siteOrigin()
): string {
  const events = buildStudySessionEvents(data, student, planOverride, origin);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsEscape(data.company)}//${icsEscape(data.className)}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${data.className} study plan`)}`,
    `X-WR-CALDESC:${icsEscape(`${student.name}'s study plan. Updates when the plan changes.`)}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const now = new Date();
  const stampNow = icsStamp(now, now.getHours(), now.getMinutes());

  events.forEach((event) => {
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${event.uid}`);
    lines.push(`DTSTAMP:${stampNow}`);
    lines.push(`DTSTART:${event.start}`);
    lines.push(`DTEND:${event.end}`);
    lines.push(icsFold(`SUMMARY:${icsEscape(event.summary)}`));
    lines.push(icsFold(`DESCRIPTION:${icsEscape(event.description)}`));
    if (event.location) lines.push(icsFold(`LOCATION:${icsEscape(event.location)}`));
    if (event.url) lines.push(icsFold(`URL:${icsEscape(event.url)}`));
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function countEvents(ics: string): number {
  return (ics.match(/BEGIN:VEVENT/g) || []).length;
}

export function countStudySessionEvents(ics: string): number {
  return (ics.match(/SUMMARY:IAC Study Session/g) || []).length;
}
