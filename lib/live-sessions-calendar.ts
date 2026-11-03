import { icsEscape, icsFold } from "./calendarSync";
import { fetchCoachingPageConfig } from "./coaching";
import { listLiveSessions, sessionFromRow, type LiveSession } from "./live-sessions";
import { getServiceSupabase } from "./supabase-admin";

export const LIVE_SESSION_CALENDAR_NAME = "IAC Skills Live Session";
export const LIVE_SESSION_CALENDAR_TOKEN = "live-sessions";
export const LIVE_SESSION_DURATION_MINUTES = 90;

export function liveSessionCalendarPath(): string {
  return `/api/calendar/${LIVE_SESSION_CALENDAR_TOKEN}.ics`;
}

export function liveSessionCalendarUrls(origin: string) {
  const http = `${origin.replace(/\/$/, "")}${liveSessionCalendarPath()}`;
  const webcal = http.replace(/^https?:/, "webcal:");
  return {
    http,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(http)}`,
  };
}

function plainText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function icsUtc(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getUTCFullYear()}${pad(value.getUTCMonth() + 1)}${pad(value.getUTCDate())}T${pad(value.getUTCHours())}${pad(value.getUTCMinutes())}${pad(value.getUTCSeconds())}Z`;
}

export function calendarSessions(sessions: LiveSession[]): LiveSession[] {
  return sessions.filter((session) => session.sessionAt && session.status !== "cancelled");
}

export function buildLiveSessionsIcs(sessions: LiveSession[], origin = ""): string {
  const portal = origin ? `${origin.replace(/\/$/, "")}/student/events` : "/student/events";
  const now = icsUtc(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    `PRODID:-//Accounting Study Advice//${icsEscape(LIVE_SESSION_CALENDAR_NAME)}//EN`,
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${icsEscape(LIVE_SESSION_CALENDAR_NAME)}`,
    `X-WR-CALDESC:${icsEscape("Upcoming IAC Skills live coaching and group sessions. Updates when the schedule changes.")}`,
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];

  calendarSessions(sessions).forEach((session) => {
    const start = new Date(session.sessionAt as string);
    if (Number.isNaN(start.getTime())) return;
    const end = new Date(start.getTime() + LIVE_SESSION_DURATION_MINUTES * 60 * 1000);
    const description = [plainText(session.description), `Join from the course: ${portal}`].filter(Boolean).join("\n\n");
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:live-session-${session.id}@accountingstudyadvice.com`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART:${icsUtc(start)}`);
    lines.push(`DTEND:${icsUtc(end)}`);
    lines.push(icsFold(`SUMMARY:${icsEscape(session.title)}`));
    lines.push(icsFold(`DESCRIPTION:${icsEscape(description)}`));
    lines.push(icsFold(`LOCATION:${icsEscape(LIVE_SESSION_CALENDAR_NAME)}`));
    lines.push(icsFold(`URL:${icsEscape(portal)}`));
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export function ensureCalendarName(ics: string, name = LIVE_SESSION_CALENDAR_NAME): string {
  const named = `X-WR-CALNAME:${icsEscape(name)}`;
  if (/^X-WR-CALNAME:/m.test(ics)) return ics.replace(/^X-WR-CALNAME:.*$/m, named);
  return ics.replace(/BEGIN:VCALENDAR(?:\r?\n)/, (match) => `${match}${named}\r\n`);
}

export async function fetchLiveSessionsForCalendar(): Promise<LiveSession[]> {
  const admin = getServiceSupabase();
  if (admin) {
    const { data, error } = await admin.from("live_sessions").select("*").order("session_at", { ascending: true });
    if (!error) return ((data || []) as Record<string, unknown>[]).map(sessionFromRow);
  }
  const listed = await listLiveSessions();
  return listed.ok ? listed.sessions : [];
}

export async function buildLiveSessionsCalendarIcs(origin: string): Promise<string> {
  const sessions = await fetchLiveSessionsForCalendar();
  if (calendarSessions(sessions).length) return buildLiveSessionsIcs(sessions, origin);

  const config = await fetchCoachingPageConfig();
  const remoteUrl = config.live_calendar_ics_url;
  if (remoteUrl) {
    try {
      const remote = await fetch(remoteUrl, { cache: "no-store" }).then((response) => (response.ok ? response.text() : ""));
      if (remote.includes("BEGIN:VCALENDAR")) return ensureCalendarName(remote);
    } catch {
      // Use the empty named calendar below.
    }
  }
  return buildLiveSessionsIcs([], origin);
}
