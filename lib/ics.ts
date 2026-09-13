import { SLOT_TIMES } from "./constants";
import { chapterCode, taskAction } from "./course";
import { longDate, today } from "./dates";
import { planStatus, upcomingLiveSessions } from "./planner";
import type { CourseData, Student, StudyPlan } from "./types";

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

/** Calendar entries link straight at the lesson route. */
export function lessonLink(lessonId: string, origin = siteOrigin()): string {
  return `${origin}/student/${lessonId}`;
}

export function buildIcs(
  data: CourseData,
  student: Student,
  planOverride?: StudyPlan,
  origin = siteOrigin()
): string {
  const status = planStatus(data, student, planOverride);
  const feedId = (student.calendar && student.calendar.token) || student.id;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//${icsEscape(data.company)}//${icsEscape(data.className)}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(`${data.className} study plan`)}`,
    `X-WR-CALDESC:${icsEscape(`${student.name}'s study plan. Updates when the plan changes.`)}`,
    // Ask subscribed clients to re-check hourly.
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  const stampNow = icsStamp(new Date(), new Date().getHours(), new Date().getMinutes());

  const push = (event) => {
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
  };

  (status ? status.cells : []).forEach((cell) => {
    const [h, m] = SLOT_TIMES[cell.period] || SLOT_TIMES.evening;
    let offset = 0;
    cell.items.forEach((item) => {
      const startMinutes = h * 60 + m + offset;
      const endMinutes = startMinutes + item.minutes;
      offset += item.minutes;
      const part = item.parts ? ` (part ${item.part} of ${item.parts})` : "";
      const askId =
        item.lesson.chapter.lessons.filter((l) => l.type === "ask").map((l) => l.id)[0] || item.lesson.id;
      const description = [
        `${taskAction(item.lesson)} · ${item.minutes} minutes`,
        `${chapterCode(item.lesson.chapter)} — ${item.lesson.chapter.title}`,
        `Course content: ${lessonLink(item.lesson.id, origin)}`,
        item.lesson.type === "upload" || item.lesson.type === "assignment" ? `Due ${item.lesson.due}` : "",
        `Ask the Coach if you get stuck: ${lessonLink(askId, origin)}`,
      ]
        .filter(Boolean)
        .join("\n");
      push({
        // Stable per lesson and part, so a rescheduled session moves in a
        // subscribed calendar instead of duplicating.
        uid: `${feedId}-${item.lesson.id}-p${item.part || 1}@accountingstudyadvice`,
        start: icsStamp(cell.date, Math.floor(startMinutes / 60), startMinutes % 60),
        end: icsStamp(cell.date, Math.floor(endMinutes / 60), endMinutes % 60),
        summary: `${data.className}: ${item.lesson.title}${part}`,
        description,
        location: lessonLink(item.lesson.id, origin),
        url: lessonLink(item.lesson.id, origin),
      });
    });
  });

  upcomingLiveSessions(data).forEach((live) => {
    const [h, m] = live.time.split(":").map(Number);
    const endMinutes = h * 60 + m + live.minutes;
    push({
      uid: `${feedId}-${live.id}@accountingstudyadvice`,
      start: icsStamp(live.when, h, m),
      end: icsStamp(live.when, Math.floor(endMinutes / 60), endMinutes % 60),
      summary: `${data.className} live: ${live.title}`,
      description: [
        `Live session with ${data.company}.`,
        `Zoom: ${live.zoom}`,
        `Course portal: ${origin}/student/${data.chapters[0].lessons[0].id}`,
      ].join("\n"),
      location: live.zoom,
      url: live.zoom,
    });
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
