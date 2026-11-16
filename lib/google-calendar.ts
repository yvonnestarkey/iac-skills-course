import { randomBytes } from "crypto";
import { sessionHasDeliverables, type StudentCoachingSession } from "./coaching";
import { guestEmails, normalizeEmail, staffEmails, uniqueNameMatch, type FirefliesStudentMatch } from "./fireflies";
import { isCoachAccount } from "./roles";
import { getServiceSupabase } from "./supabase-admin";

export const GOOGLE_CALENDAR_SQL_HINT =
  "Paste supabase/google-calendar-coaching.sql in the Supabase SQL editor, then try again.";
export const GOOGLE_CALENDAR_IMPORT_FROM = "2026-01-01T00:00:00.000Z";
export const IAC_CALENDAR_EVENT_MARKER = "IAC January 2027";
export const GOOGLE_CALENDAR_SCOPE =
  "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/userinfo.email";
export const CALENDAR_IGNORE_EMAILS = [
  "noreply@calendly.com",
  "webmaster@calendly.com",
  "notifications@calendly.com",
  "calendar-notification@google.com",
  "comments@calendly.com",
];

export type CalendarStudent = FirefliesStudentMatch;
export type CalendarImportStatus = "imported" | "unmatched" | "skipped" | "error" | "cancelled";

export type GoogleCalendarAttendee = {
  email?: string | null;
  displayName?: string | null;
  responseStatus?: string | null;
  self?: boolean | null;
  organizer?: boolean | null;
};

export type GoogleCalendarEvent = {
  id?: string | null;
  status?: string | null;
  summary?: string | null;
  description?: string | null;
  htmlLink?: string | null;
  hangoutLink?: string | null;
  start?: { dateTime?: string | null; date?: string | null } | null;
  attendees?: GoogleCalendarAttendee[] | null;
  organizer?: { email?: string | null; displayName?: string | null } | null;
};

export type GoogleCalendarSettingsView = {
  connected: boolean;
  googleEmail: string;
  lastSyncAt: string | null;
  configured: boolean;
  redirectUri: string;
  webhookUrl: string;
  watchActive: boolean;
};

type StoredSettings = {
  google_email?: string | null;
  refresh_token?: string | null;
  access_token?: string | null;
  access_token_expires_at?: string | null;
  sync_token?: string | null;
  last_sync_at?: string | null;
  channel_id?: string | null;
  resource_id?: string | null;
  channel_expiration?: string | null;
  oauth_state?: string | null;
};

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function tableMissing(message: string): boolean {
  return /google_calendar_settings|google_calendar_imports|google_event_id|does not exist|schema cache/i.test(message);
}

function missingColumn(message: string): string | null {
  const match =
    message.match(/Could not find the '([^']+)' column/i) || message.match(/'([^']+)' column of '/i);
  return match?.[1] || null;
}

export function googleCalendarSiteOrigin(
  origin = process.env.NEXT_PUBLIC_SITE_URL || "https://iac.accountingstudyadvice.com"
): string {
  return String(origin).replace(/\/$/, "");
}

export function googleCalendarRedirectUri(origin?: string): string {
  return `${googleCalendarSiteOrigin(origin)}/api/coach/google-calendar/callback`;
}

export function googleCalendarWebhookUrl(origin?: string): string {
  return `${googleCalendarSiteOrigin(origin)}/api/google-calendar/webhook`;
}

export function googleOAuthConfigured(): boolean {
  return Boolean(asText(process.env.GOOGLE_CLIENT_ID) && asText(process.env.GOOGLE_CLIENT_SECRET));
}

export function emailsFromText(value: string): string[] {
  const matches = String(value || "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  const emails: string[] = [];
  matches.forEach((email) => {
    const normalized = normalizeEmail(email);
    if (normalized && !emails.includes(normalized)) emails.push(normalized);
  });
  return emails;
}

export function calendarEventEmails(event: GoogleCalendarEvent): string[] {
  const emails: string[] = [];
  const push = (value: unknown) => {
    const email = normalizeEmail(value);
    if (email && email.includes("@") && !emails.includes(email)) emails.push(email);
  };
  (event.attendees || []).forEach((row) => push(row?.email));
  push(event.organizer?.email);
  emailsFromText(asText(event.description)).forEach(push);
  return emails;
}

export function calendarEventNames(event: GoogleCalendarEvent): string[] {
  const names: string[] = [];
  const add = (value: unknown) => {
    const name = asText(value);
    if (name && !names.includes(name)) names.push(name);
  };
  (event.attendees || []).forEach((row) => add(row?.displayName));
  add(event.organizer?.displayName);
  return names;
}

export function calendarGuestEmails(emails: string[]): string[] {
  return guestEmails(emails, [...staffEmails(), ...CALENDAR_IGNORE_EMAILS]);
}

export function calendarEventStart(event: GoogleCalendarEvent): string | null {
  const dateTime = asText(event.start?.dateTime);
  if (dateTime) {
    const at = new Date(dateTime);
    return Number.isNaN(at.getTime()) ? null : at.toISOString();
  }
  return null;
}

export function calendarMeetingUrl(event: GoogleCalendarEvent): string {
  return asText(event.hangoutLink) || asText(event.htmlLink);
}

export function isTimedCalendarEvent(event: GoogleCalendarEvent): boolean {
  return Boolean(calendarEventStart(event));
}

export function isIacOneOnOneCalendarEvent(event: GoogleCalendarEvent): boolean {
  const title = asText(event.summary);
  if (!title.toLowerCase().includes(IAC_CALENDAR_EVENT_MARKER.toLowerCase())) return false;
  if (/\bbuffer\b/i.test(title)) return false;
  return true;
}

export function matchCalendarStudent(
  students: CalendarStudent[],
  event: GoogleCalendarEvent
): { student: CalendarStudent | null; reason: string; emails: string[] } {
  const emails = calendarEventEmails(event);
  const guests = calendarGuestEmails(emails);
  const hits = students.filter((student) => guests.includes(normalizeEmail(student.email)));
  if (hits.length > 1) {
    return { student: null, reason: "Several students were on this event, so it was left unmatched.", emails };
  }
  if (hits.length === 1) return { student: hits[0], reason: "", emails };
  if (guests.length > 1) {
    return { student: null, reason: "This calendar event has extra guests, so it was left unmatched.", emails };
  }
  const byName = uniqueNameMatch(students, calendarEventNames(event), asText(event.summary));
  if (byName) return { student: byName, reason: "", emails };
  return { student: null, reason: "No student email or name on this calendar event matched a profile.", emails };
}

export function studentDeclinedEvent(event: GoogleCalendarEvent, studentEmail: string): boolean {
  const wanted = normalizeEmail(studentEmail);
  const attendee = (event.attendees || []).find((row) => normalizeEmail(row?.email) === wanted);
  return asText(attendee?.responseStatus).toLowerCase() === "declined";
}

async function loadSettingsRow(): Promise<StoredSettings | null> {
  const client = getServiceSupabase();
  if (!client) return null;
  const { data, error } = await client.from("google_calendar_settings").select("*").eq("id", 1).maybeSingle();
  if (error) {
    if (!tableMissing(error.message)) console.error("google_calendar_settings", error.message);
    return null;
  }
  return (data as StoredSettings | null) || null;
}

async function upsertSettings(patch: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("google_calendar_settings").upsert({
    id: 1,
    ...patch,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    return { ok: false, error: tableMissing(error.message) ? GOOGLE_CALENDAR_SQL_HINT : error.message };
  }
  return { ok: true };
}

export async function getGoogleCalendarSettings(): Promise<GoogleCalendarSettingsView> {
  const row = await loadSettingsRow();
  return {
    connected: Boolean(asText(row?.refresh_token)),
    googleEmail: asText(row?.google_email),
    lastSyncAt: asText(row?.last_sync_at) || null,
    configured: googleOAuthConfigured(),
    redirectUri: googleCalendarRedirectUri(),
    webhookUrl: googleCalendarWebhookUrl(),
    watchActive: Boolean(asText(row?.channel_id) && asText(row?.resource_id)),
  };
}

export async function createGoogleOAuthState(): Promise<string> {
  const state = randomBytes(24).toString("hex");
  await upsertSettings({ oauth_state: state });
  return state;
}

export function googleAuthorizeUrl(state: string, origin?: string): string {
  const params = new URLSearchParams({
    client_id: asText(process.env.GOOGLE_CLIENT_ID),
    redirect_uri: googleCalendarRedirectUri(origin),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeGoogleToken(body: Record<string, string>): Promise<Record<string, unknown>> {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(asText(payload.error_description) || asText(payload.error) || "Google could not issue a calendar token.");
  }
  return payload;
}

export async function finishGoogleOAuth(code: string, state: string, origin?: string): Promise<{ ok: boolean; error?: string }> {
  if (!googleOAuthConfigured()) return { ok: false, error: "Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel, then try again." };
  const row = await loadSettingsRow();
  if (!asText(row?.oauth_state) || asText(row?.oauth_state) !== asText(state)) {
    return { ok: false, error: "That Google sign-in expired. Connect again from Coach tools." };
  }
  const token = await exchangeGoogleToken({
    code: asText(code),
    client_id: asText(process.env.GOOGLE_CLIENT_ID),
    client_secret: asText(process.env.GOOGLE_CLIENT_SECRET),
    redirect_uri: googleCalendarRedirectUri(origin),
    grant_type: "authorization_code",
  });
  const refresh = asText(token.refresh_token) || asText(row?.refresh_token);
  if (!refresh) return { ok: false, error: "Google did not return a refresh token. Disconnect in Google, then connect again." };
  const expiresIn = Number(token.expires_in || 0) || 3600;
  await upsertSettings({
    refresh_token: refresh,
    access_token: asText(token.access_token),
    access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
    oauth_state: null,
    sync_token: null,
  });
  const email = await fetchPrimaryCalendarEmail();
  if (email) await upsertSettings({ google_email: email });
  await registerGoogleCalendarWatch();
  await syncGoogleCalendarEvents();
  return { ok: true };
}

async function accessToken(): Promise<string> {
  const row = await loadSettingsRow();
  const refresh = asText(row?.refresh_token);
  if (!refresh) throw new Error("Connect Google Calendar in Coach tools first.");
  const expiresAt = asText(row?.access_token_expires_at);
  const current = asText(row?.access_token);
  if (current && expiresAt && new Date(expiresAt).getTime() - 60_000 > Date.now()) return current;
  const token = await exchangeGoogleToken({
    refresh_token: refresh,
    client_id: asText(process.env.GOOGLE_CLIENT_ID),
    client_secret: asText(process.env.GOOGLE_CLIENT_SECRET),
    grant_type: "refresh_token",
  });
  const next = asText(token.access_token);
  const expiresIn = Number(token.expires_in || 0) || 3600;
  await upsertSettings({
    access_token: next,
    access_token_expires_at: new Date(Date.now() + expiresIn * 1000).toISOString(),
  });
  return next;
}

async function googleFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await accessToken();
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

async function fetchPrimaryCalendarEmail(): Promise<string> {
  try {
    const response = await googleFetch("/calendars/primary");
    const payload = (await response.json().catch(() => ({}))) as { id?: string };
    const id = asText(payload.id);
    return id.includes("@") ? normalizeEmail(id) : "";
  } catch {
    return "";
  }
}

export async function loadCalendarStudents(): Promise<CalendarStudent[]> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data } = await client.from("profiles").select("id, email, full_name, role");
  return ((data || []) as Array<Record<string, unknown>>)
    .filter((row) => asText(row.id) && asText(row.email).includes("@") && !isCoachAccount(row))
    .map((row) => ({
      id: String(row.id),
      email: asText(row.email),
      fullName: asText(row.full_name),
    }));
}

async function logImport(row: {
  eventId: string;
  title?: string;
  studentId?: string | null;
  status: CalendarImportStatus;
  attendeeEmails?: string[];
  error?: string;
}) {
  const client = getServiceSupabase();
  if (!client) return;
  await client.from("google_calendar_imports").insert({
    event_id: row.eventId,
    title: row.title || null,
    student_id: row.studentId || null,
    status: row.status,
    attendee_emails: row.attendeeEmails || [],
    error: row.error || null,
  });
}

export async function listGoogleCalendarImports(): Promise<
  Array<{
    id: string;
    eventId: string;
    title: string;
    status: string;
    attendeeEmails: string[];
    error: string;
    createdAt: string;
  }>
> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("google_calendar_imports")
    .select("id, event_id, title, status, attendee_emails, error, created_at")
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return [];
  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: asText(row.id),
    eventId: asText(row.event_id),
    title: asText(row.title),
    status: asText(row.status),
    attendeeEmails: Array.isArray(row.attendee_emails) ? row.attendee_emails.map((item) => String(item)) : [],
    error: asText(row.error),
    createdAt: asText(row.created_at),
  }));
}

async function existingSessionForEvent(eventId: string, studentId: string, sessionAt: string | null) {
  const client = getServiceSupabase();
  if (!client) return null;
  const byEvent = await client
    .from("student_coaching_sessions")
    .select("*")
    .eq("google_event_id", eventId)
    .maybeSingle();
  if (!byEvent.error && byEvent.data) return byEvent.data as Record<string, unknown>;
  if (!sessionAt) return null;
  const start = new Date(sessionAt).getTime() - 36 * 60 * 60 * 1000;
  const end = new Date(sessionAt).getTime() + 36 * 60 * 60 * 1000;
  const nearby = await client
    .from("student_coaching_sessions")
    .select("*")
    .eq("student_id", studentId)
    .gte("session_at", new Date(start).toISOString())
    .lte("session_at", new Date(end).toISOString())
    .order("session_at", { ascending: false })
    .limit(1);
  if (nearby.error) return null;
  return ((nearby.data || [])[0] as Record<string, unknown> | undefined) || null;
}

function sessionFromUnknown(row: Record<string, unknown>): Pick<StudentCoachingSession, "status" | "recordingUrl" | "pdfSummaryUrl" | "summaryText" | "transcriptText" | "firefliesTranscriptUrl" | "coachNotes"> {
  return {
    status: asText(row.status) === "completed" ? "completed" : asText(row.status) === "cancelled" ? "cancelled" : "scheduled",
    recordingUrl: asText(row.recording_url) || asText(row.vimeo_recording_url),
    pdfSummaryUrl: asText(row.pdf_summary_url) || asText(row.fireflies_pdf_url),
    summaryText: asText(row.summary_text),
    transcriptText: asText(row.transcript_text),
    firefliesTranscriptUrl: asText(row.fireflies_transcript_url),
    coachNotes: asText(row.coach_notes),
  };
}

async function upsertScheduledSession(input: {
  studentId: string;
  eventId: string;
  title: string;
  sessionAt: string | null;
  meetingUrl: string;
  cancelled: boolean;
}) {
  const client = getServiceSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const existing = await existingSessionForEvent(input.eventId, input.studentId, input.sessionAt);
  const current = existing ? sessionFromUnknown(existing) : null;
  const keepCompleted = Boolean(current && (current.status === "completed" || sessionHasDeliverables(current as StudentCoachingSession)));
  const status = keepCompleted ? "completed" : input.cancelled ? "cancelled" : "scheduled";
  const patch: Record<string, unknown> = {
    student_id: input.studentId,
    status,
    google_event_id: input.eventId,
    title: input.title || "1-on-1 coaching",
    meeting_url: input.meetingUrl || null,
    updated_at: new Date().toISOString(),
  };
  if (input.sessionAt) patch.session_at = input.sessionAt;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = existing?.id
      ? await client.from("student_coaching_sessions").update(patch).eq("id", existing.id).select("id")
      : await client.from("student_coaching_sessions").insert(patch).select("id");
    if (!result.error) return status;
    const missing = missingColumn(result.error.message);
    if (missing && missing in patch) {
      delete patch[missing];
      continue;
    }
    throw new Error(result.error.message);
  }
  throw new Error(GOOGLE_CALENDAR_SQL_HINT);
}

export async function importGoogleCalendarEvent(
  event: GoogleCalendarEvent,
  students?: CalendarStudent[]
): Promise<{ ok: boolean; status: CalendarImportStatus; error?: string }> {
  const eventId = asText(event.id);
  if (!eventId) return { ok: false, status: "error", error: "Calendar event is missing an id." };
  if (!isIacOneOnOneCalendarEvent(event)) return { ok: true, status: "skipped" };
  if (!isTimedCalendarEvent(event) && asText(event.status).toLowerCase() !== "cancelled") {
    return { ok: true, status: "skipped" };
  }
  const roster = students || (await loadCalendarStudents());
  const match = matchCalendarStudent(roster, event);
  const title = asText(event.summary) || "1-on-1 coaching";
  if (!match.student) {
    await logImport({ eventId, title, status: "unmatched", attendeeEmails: match.emails, error: match.reason });
    return { ok: true, status: "unmatched" };
  }
  const cancelled =
    asText(event.status).toLowerCase() === "cancelled" || studentDeclinedEvent(event, match.student.email);
  const savedStatus = await upsertScheduledSession({
    studentId: match.student.id,
    eventId,
    title,
    sessionAt: calendarEventStart(event),
    meetingUrl: calendarMeetingUrl(event),
    cancelled,
  });
  const status: CalendarImportStatus = savedStatus === "cancelled" ? "cancelled" : "imported";
  await logImport({
    eventId,
    title,
    studentId: match.student.id,
    status,
    attendeeEmails: match.emails,
  });
  return { ok: true, status };
}

async function listCalendarEvents(syncToken?: string | null): Promise<{
  events: GoogleCalendarEvent[];
  nextSyncToken: string | null;
  reset?: boolean;
}> {
  const events: GoogleCalendarEvent[] = [];
  let pageToken = "";
  let nextSyncToken = "";
  for (let page = 0; page < 20; page += 1) {
    const params = new URLSearchParams({
      maxResults: "250",
    });
    if (syncToken) {
      params.set("syncToken", syncToken);
    } else {
      params.set("singleEvents", "true");
      params.set("showDeleted", "true");
      params.set("timeMin", GOOGLE_CALENDAR_IMPORT_FROM);
      params.set("timeMax", new Date(Date.now() + 548 * 86400000).toISOString());
    }
    if (pageToken) params.set("pageToken", pageToken);
    const response = await googleFetch(`/calendars/primary/events?${params.toString()}`);
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { code?: number; message?: string };
      items?: GoogleCalendarEvent[];
      nextPageToken?: string;
      nextSyncToken?: string;
    };
    if (response.status === 410) return { events: [], nextSyncToken: null, reset: true };
    if (!response.ok) {
      throw new Error(asText(payload.error?.message) || "Could not read Google Calendar.");
    }
    (payload.items || []).forEach((item) => events.push(item));
    pageToken = asText(payload.nextPageToken);
    nextSyncToken = asText(payload.nextSyncToken);
    if (!pageToken) break;
  }
  return { events, nextSyncToken: nextSyncToken || null };
}

export async function registerGoogleCalendarWatch(): Promise<void> {
  const row = await loadSettingsRow();
  if (!asText(row?.refresh_token)) return;
  const expiration = asText(row?.channel_expiration);
  if (expiration && new Date(expiration).getTime() - 12 * 60 * 60 * 1000 > Date.now() && asText(row?.channel_id)) {
    return;
  }
  const channelId = `iac-cal-${randomBytes(8).toString("hex")}`;
  const response = await googleFetch("/calendars/primary/events/watch", {
    method: "POST",
    body: JSON.stringify({
      id: channelId,
      type: "web_hook",
      address: googleCalendarWebhookUrl(),
      token: channelId,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    id?: string;
    resourceId?: string;
    expiration?: string;
    error?: { message?: string };
  };
  if (!response.ok) {
    console.error("google calendar watch", asText(payload.error?.message) || response.status);
    return;
  }
  const expires = payload.expiration ? new Date(Number(payload.expiration)).toISOString() : null;
  await upsertSettings({
    channel_id: asText(payload.id) || channelId,
    resource_id: asText(payload.resourceId),
    channel_expiration: expires,
  });
}

export function googleWebhookChannelMatches(channelId: string, resourceId: string, stored: StoredSettings | null): boolean {
  if (!stored) return false;
  return asText(stored.channel_id) === asText(channelId) && asText(stored.resource_id) === asText(resourceId);
}

export async function googleWebhookIsAuthorized(channelId: string, resourceId: string): Promise<boolean> {
  const row = await loadSettingsRow();
  return googleWebhookChannelMatches(channelId, resourceId, row);
}

export async function syncGoogleCalendarEvents(): Promise<{
  ok: boolean;
  scanned: number;
  imported: number;
  unmatched: number;
  skipped: number;
  cancelled: number;
  errors: number;
  error?: string;
}> {
  const empty = { scanned: 0, imported: 0, unmatched: 0, skipped: 0, cancelled: 0, errors: 0 };
  const row = await loadSettingsRow();
  if (!asText(row?.refresh_token)) return { ok: true, ...empty };
  if (asText(row?.last_sync_at) && Date.now() - new Date(String(row?.last_sync_at)).getTime() < 8000) {
    return { ok: true, ...empty };
  }
  try {
    const students = await loadCalendarStudents();
    let listed = await listCalendarEvents(asText(row?.sync_token) || null);
    if (listed.reset) listed = await listCalendarEvents(null);
    let imported = 0;
    let unmatched = 0;
    let skipped = 0;
    let cancelled = 0;
    let errors = 0;
    for (const event of listed.events) {
      try {
        const result = await importGoogleCalendarEvent(event, students);
        if (result.status === "imported") imported += 1;
        else if (result.status === "unmatched") unmatched += 1;
        else if (result.status === "cancelled") cancelled += 1;
        else if (result.status === "error") errors += 1;
        else skipped += 1;
      } catch (error) {
        errors += 1;
        console.error("google calendar event", error);
      }
    }
    await upsertSettings({
      sync_token: listed.nextSyncToken || asText(row?.sync_token) || null,
      last_sync_at: new Date().toISOString(),
    });
    await registerGoogleCalendarWatch();
    return { ok: true, scanned: listed.events.length, imported, unmatched, skipped, cancelled, errors };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync Google Calendar.";
    return { ok: false, ...empty, error: tableMissing(message) ? GOOGLE_CALENDAR_SQL_HINT : message };
  }
}

export async function disconnectGoogleCalendar(): Promise<{ ok: boolean; error?: string }> {
  const row = await loadSettingsRow();
  if (asText(row?.channel_id) && asText(row?.resource_id)) {
    try {
      await googleFetch("/channels/stop", {
        method: "POST",
        body: JSON.stringify({ id: row?.channel_id, resourceId: row?.resource_id }),
      });
    } catch {
      /* still clear local tokens */
    }
  }
  return upsertSettings({
    google_email: null,
    refresh_token: null,
    access_token: null,
    access_token_expires_at: null,
    sync_token: null,
    last_sync_at: null,
    channel_id: null,
    resource_id: null,
    channel_expiration: null,
    oauth_state: null,
  });
}
