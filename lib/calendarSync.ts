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

/** Flatten packed planner cells into timed lessons, then group by calendar day. */
export function collectTimedLessons(cells: ScheduledSession[]): TimedLesson[] {
  const lessons: TimedLesson[] = [];
  cells.forEach((cell) => {
    let cursor = slotMinutes(cell.period);
    cell.items.forEach((item) => {
      const duration = Math.max(0, Number(item.minutes) || 0);
      if (!duration) return;
      lessons.push({
        dateKey: isoDate(cell.date),
        date: cell.date,
        startMinutes: cursor,
        endMinutes: cursor + duration,
        title: item.lesson.title,
      });
      cursor += duration;
    });
  });
  return lessons;
}

export function groupLessonsByDate(lessons: TimedLesson[]): TimedLesson[][] {
  const groups = new Map<string, TimedLesson[]>();
  lessons.forEach((lesson) => {
    const current = groups.get(lesson.dateKey);
    if (current) current.push(lesson);
    else groups.set(lesson.dateKey, [lesson]);
  });
  return [...groups.values()];
}

function dailyStudyEvent(lessons: TimedLesson[], feedId: string): CalendarEventPayload {
  const date = lessons[0].date;
  const dateKey = lessons[0].dateKey;
  const startMinutes = Math.min(...lessons.map((lesson) => lesson.startMinutes));
  const endMinutes = Math.max(...lessons.map((lesson) => lesson.endMinutes));
  const titles: string[] = [];
  lessons.forEach((lesson) => {
    if (titles[titles.length - 1] !== lesson.title) titles.push(lesson.title);
  });
  const description = [
    "IAC Skills Course Study Session",
    "",
    `Resume your course: ${COURSE_RESUME_URL}`,
    "",
    "Tasks scheduled for today:",
    ...titles.map((title) => `• ${title}`),
  ].join("\n");

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

function oneStudyEventPerDay(events: CalendarEventPayload[]): CalendarEventPayload[] {
  const byDay = new Map<string, CalendarEventPayload>();
  events.forEach((event) => {
    const day = event.start.slice(0, 8);
    const existing = byDay.get(day);
    if (!existing) {
      byDay.set(day, event);
      return;
    }
    const start = existing.start < event.start ? existing.start : event.start;
    const end = existing.end > event.end ? existing.end : event.end;
    const titles = new Set(
      `${existing.description}\n${event.description}`
        .split("\n")
        .filter((line) => line.startsWith("• "))
    );
    byDay.set(day, {
      ...existing,
      start,
      end,
      description: [
        "IAC Skills Course Study Session",
        "",
        `Resume your course: ${COURSE_RESUME_URL}`,
        "",
        "Tasks scheduled for today:",
        ...titles,
      ].join("\n"),
    });
  });
  return [...byDay.values()];
}

/** Exactly one study VEVENT per calendar day. Live Zoom sessions stay separate. */
export function buildStudySessionEvents(
  data: CourseData,
  student: Student,
  planOverride?: StudyPlan,
  origin = siteOrigin()
): CalendarEventPayload[] {
  const status = planStatus(data, student, planOverride);
  const feedId = (student.calendar && student.calendar.token) || student.id;
  const timed = collectTimedLessons(status ? status.cells : []);
  const studyEvents = oneStudyEventPerDay(
    groupLessonsByDate(timed).map((lessons) => dailyStudyEvent(lessons, feedId))
  );

  const liveEvents: CalendarEventPayload[] = upcomingLiveSessions(data).map((live) => {
    const [hours, minutes] = live.time.split(":").map(Number);
    const endMinutes = hours * 60 + minutes + live.minutes;
    return {
      uid: `${feedId}-${live.id}@accountingstudyadvice`,
      start: icsStamp(live.when, hours, minutes),
      end: icsStamp(live.when, Math.floor(endMinutes / 60), endMinutes % 60),
      summary: `${data.className} live: ${live.title}`,
      description: [`Live session with ${data.company}.`, `Zoom: ${live.zoom}`, `Course portal: ${courseResumeLink(origin)}`].join(
        "\n"
      ),
      location: live.zoom,
      url: live.zoom,
    };
  });

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
