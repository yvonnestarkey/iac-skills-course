import { SLOT_TIMES } from "./constants";
import { taskAction } from "./course";
import { isoDate, longDate, today } from "./dates";
import { planStatus, upcomingLiveSessions } from "./planner";
import type { CourseData, ScheduledSession, Student, StudyPlan } from "./types";

const SESSION_TITLE = "IAC Study Session";

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

export function courseResumeLink(origin = siteOrigin()): string {
  return `${origin}/student/overview`;
}

export function lessonLink(lessonId: string, origin = siteOrigin()): string {
  return `${origin}/student/${lessonId}`;
}

function slotClock(period: string): [number, number] {
  const [hours, minutes] = SLOT_TIMES[period] || SLOT_TIMES.evening;
  return [hours, minutes];
}

function topicLine(item: ScheduledSession["items"][number]): string {
  const part = item.parts ? ` (part ${item.part} of ${item.parts})` : "";
  return `• ${taskAction(item.lesson)}: ${item.lesson.title}${part} (${item.minutes} min)`;
}

function sessionDescription(cell: ScheduledSession, origin: string): string {
  const resume = courseResumeLink(origin);
  const topics = cell.items.map(topicLine);
  return [
    `Open the course: ${resume}`,
    "",
    "Queued for this session:",
    ...(topics.length ? topics : ["• No lessons queued"]),
  ].join("\n");
}

function sessionEvent(cell: ScheduledSession, feedId: string, origin: string): CalendarEventPayload {
  const [hours, minutes] = slotClock(cell.period);
  const duration = cell.capacity || cell.used || 0;
  const endMinutes = hours * 60 + minutes + duration;
  const resume = courseResumeLink(origin);
  return {
    uid: `${feedId}-${isoDate(cell.date)}-${cell.period}@accountingstudyadvice`,
    start: icsStamp(cell.date, hours, minutes),
    end: icsStamp(cell.date, Math.floor(endMinutes / 60), endMinutes % 60),
    summary: SESSION_TITLE,
    description: sessionDescription(cell, origin),
    location: resume,
    url: resume,
  };
}

/** Shared session payloads for ICS download and Google Calendar URLs. */
export function buildStudySessionEvents(
  data: CourseData,
  student: Student,
  planOverride?: StudyPlan,
  origin = siteOrigin()
): CalendarEventPayload[] {
  const status = planStatus(data, student, planOverride);
  const feedId = (student.calendar && student.calendar.token) || student.id;
  const events = (status ? status.cells : [])
    .filter((cell) => cell.items.length)
    .map((cell) => sessionEvent(cell, feedId, origin));

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
