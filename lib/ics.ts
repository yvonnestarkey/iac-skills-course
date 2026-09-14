import { PERIODS, SLOT_TIMES } from "./constants";
import { isoDate, longDate, today } from "./dates";
import { planStatus, upcomingLiveSessions } from "./planner";
import type { CourseData, ScheduledSession, Student, StudyPlan } from "./types";

const SESSION_TITLE = "IAC Study Session";
const COURSE_RESUME_URL = "https://iac.accountingstudyadvice.com/student/overview";
const PERIOD_ORDER = PERIODS.map((period) => period.id);

export interface CalendarEventPayload {
  uid: string;
  start: string;
  end: string;
  summary: string;
  description: string;
  location?: string;
  url?: string;
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
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
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

function cellsByDay(cells: ScheduledSession[]): ScheduledSession[][] {
  const groups = new Map<string, ScheduledSession[]>();
  const order: string[] = [];
  cells.forEach((cell) => {
    if (!cell.items.length) return;
    const key = isoDate(cell.date);
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(cell);
  });
  return order.map((key) =>
    groups.get(key)!.sort((a, b) => PERIOD_ORDER.indexOf(a.period) - PERIOD_ORDER.indexOf(b.period))
  );
}

function dailyTopicTitles(cells: ScheduledSession[]): string[] {
  const titles: string[] = [];
  cells.forEach((cell) => {
    cell.items.forEach((item) => {
      if (titles[titles.length - 1] !== item.lesson.title) titles.push(item.lesson.title);
    });
  });
  return titles;
}

function dailyStudyEvent(cells: ScheduledSession[], feedId: string): CalendarEventPayload {
  const date = cells[0].date;
  const startMinutes = Math.min(...cells.map((cell) => slotMinutes(cell.period)));
  const endMinutes = Math.max(
    ...cells.map((cell) => slotMinutes(cell.period) + (cell.used || cell.capacity || 0))
  );
  const topics = dailyTopicTitles(cells);
  const description = [
    "IAC Skills Course Study Session",
    "",
    `Resume course: ${COURSE_RESUME_URL}`,
    "",
    "Scheduled Topics:",
    ...topics.map((title) => `- ${title}`),
  ].join("\n");

  return {
    uid: `${feedId}-${isoDate(date)}@accountingstudyadvice`,
    start: icsStamp(date, Math.floor(startMinutes / 60), startMinutes % 60),
    end: icsStamp(date, Math.floor(endMinutes / 60), endMinutes % 60),
    summary: SESSION_TITLE,
    description,
    location: COURSE_RESUME_URL,
    url: COURSE_RESUME_URL,
  };
}

/** One study VEVENT per calendar day, plus separate live Zoom events. */
export function buildStudySessionEvents(
  data: CourseData,
  student: Student,
  planOverride?: StudyPlan,
  origin = siteOrigin()
): CalendarEventPayload[] {
  const status = planStatus(data, student, planOverride);
  const feedId = (student.calendar && student.calendar.token) || student.id;
  const events = cellsByDay(status ? status.cells : []).map((cells) => dailyStudyEvent(cells, feedId));

  upcomingLiveSessions(data).forEach((live) => {
    const [hours, minutes] = live.time.split(":").map(Number);
    const endMinutes = hours * 60 + minutes + live.minutes;
    events.push({
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
  });

  return events;
}

/** Add-one-event URL used by Google Calendar (same payload as the .ics VEVENT). */
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
  const stampNow = icsStamp(new Date(), new Date().getHours(), new Date().getMinutes());

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

/* ---------- Calendar subscription ---------- */

export function feedToken(student: Student): string {
  if (student.calendar && student.calendar.token) return student.calendar.token;
  const random = Math.random().toString(36).slice(2, 10);
  return `${student.id}-${random}`;
}

export function feedUrls(token: string, origin = siteOrigin()) {
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

export function countEvents(ics: string): number {
  return (ics.match(/BEGIN:VEVENT/g) || []).length;
}
