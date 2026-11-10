import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { allowedCoachEmails, isCoachAccount } from "./roles";
import { getServiceSupabase } from "./supabase-admin";

export const FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql";
export const FIREFLIES_SQL_HINT = "Paste supabase/fireflies-coaching.sql in the Supabase SQL editor, then try again.";
export const FIREFLIES_IMPORT_EVENTS = new Set(["meeting.transcribed", "meeting.summarized", "transcription completed"]);

export type FirefliesAttendee = {
  displayName?: string | null;
  email?: string | null;
  name?: string | null;
};

export type FirefliesSummary = {
  overview?: string | null;
  short_summary?: string | null;
  short_overview?: string | null;
  action_items?: string | string[] | null;
  shorthand_bullet?: string | null;
  outline?: string | null;
  gist?: string | null;
};

export type FirefliesSentence = {
  speaker_name?: string | null;
  text?: string | null;
};

export type FirefliesTranscript = {
  id?: string | null;
  title?: string | null;
  date?: number | string | null;
  transcript_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  host_email?: string | null;
  organizer_email?: string | null;
  participants?: string[] | null;
  meeting_attendees?: FirefliesAttendee[] | null;
  summary?: FirefliesSummary | null;
  sentences?: FirefliesSentence[] | null;
};

export type FirefliesWebhookEvent = {
  meetingId: string;
  event: string;
};

export type FirefliesStudentMatch = {
  id: string;
  email: string;
  fullName: string;
};

export type FirefliesImportStatus = "imported" | "unmatched" | "skipped" | "error";

const TRANSCRIPT_QUERY = `query Transcript($transcriptId: String!) {
  transcript(id: $transcriptId) {
    id
    title
    date
    transcript_url
    audio_url
    video_url
    host_email
    organizer_email
    participants
    meeting_attendees { displayName email name }
    summary {
      overview
      short_summary
      short_overview
      action_items
      shorthand_bullet
      outline
      gist
    }
    sentences { speaker_name text }
  }
}`;

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(value: unknown): string {
  return asText(value).toLowerCase();
}

export function generateFirefliesWebhookSecret(): string {
  return `ffwh_${randomBytes(24).toString("hex")}`;
}

export function firefliesWebhookUrl(origin = process.env.NEXT_PUBLIC_SITE_URL || "https://iac.accountingstudyadvice.com"): string {
  return `${String(origin).replace(/\/$/, "")}/api/fireflies/webhook`;
}

export function parseFirefliesWebhook(body: unknown): FirefliesWebhookEvent | null {
  if (!body || typeof body !== "object") return null;
  const row = body as Record<string, unknown>;
  const meetingId = asText(row.meeting_id || row.meetingId);
  const event = asText(row.event || row.eventType).toLowerCase();
  if (!meetingId) return null;
  return { meetingId, event: event || "meeting.transcribed" };
}

export function shouldImportFirefliesEvent(event: string): boolean {
  return FIREFLIES_IMPORT_EVENTS.has(event.trim().toLowerCase());
}

export function verifyFirefliesSignature(rawBody: string, signature: string | null | undefined, secret: string): boolean {
  const header = asText(signature);
  const key = asText(secret);
  if (!header || !key) return false;
  const expected = `sha256=${createHmac("sha256", key).update(rawBody, "utf8").digest("hex")}`;
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function firefliesApiKeyFrom(envKey?: string | null, storedKey?: string | null): string {
  return asText(envKey) || asText(storedKey);
}

export function maskSecret(value: string | null | undefined): string {
  const text = asText(value);
  if (!text) return "";
  if (text.length <= 4) return "••••";
  return `••••${text.slice(-4)}`;
}

function pushEmail(target: string[], value: unknown) {
  const email = normalizeEmail(value);
  if (email && email.includes("@") && !target.includes(email)) target.push(email);
}

export function attendeeEmails(transcript: FirefliesTranscript | null | undefined): string[] {
  const emails: string[] = [];
  (transcript?.meeting_attendees || []).forEach((row) => pushEmail(emails, row?.email));
  (transcript?.participants || []).forEach((row) => pushEmail(emails, row));
  pushEmail(emails, transcript?.host_email);
  pushEmail(emails, transcript?.organizer_email);
  return emails;
}

export function attendeeNames(transcript: FirefliesTranscript | null | undefined): string[] {
  const names: string[] = [];
  const add = (value: unknown) => {
    const name = asText(value);
    if (name && !names.includes(name)) names.push(name);
  };
  (transcript?.meeting_attendees || []).forEach((row) => {
    add(row?.name);
    add(row?.displayName);
  });
  return names;
}

export function staffEmails(): string[] {
  return allowedCoachEmails();
}

export function guestEmails(emails: string[], staff = staffEmails()): string[] {
  const blocked = new Set(staff.map(normalizeEmail));
  return emails.filter((email) => !blocked.has(email));
}

export function uniqueStudentMatch(students: FirefliesStudentMatch[], emails: string[]): FirefliesStudentMatch | null {
  const wanted = new Set(guestEmails(emails).map(normalizeEmail));
  const hits = students.filter((student) => wanted.has(normalizeEmail(student.email)));
  return hits.length === 1 ? hits[0] : null;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function uniqueNameMatch(students: FirefliesStudentMatch[], names: string[], title = ""): FirefliesStudentMatch | null {
  const needles = names.map(normalizeName).filter((name) => name.length >= 3);
  const titleName = normalizeName(title);
  const hits = students.filter((student) => {
    const full = normalizeName(student.fullName);
    if (!full) return false;
    if (needles.some((name) => name === full || name.includes(full) || full.includes(name))) return true;
    return Boolean(titleName) && titleName.includes(full);
  });
  const unique = [...new Map(hits.map((row) => [row.id, row])).values()];
  return unique.length === 1 ? unique[0] : null;
}

function asLines(value: string | string[] | null | undefined): string {
  if (Array.isArray(value)) return value.map((item) => asText(item)).filter(Boolean).join("\n");
  return asText(value);
}

export function formatFirefliesSummary(summary: FirefliesSummary | null | undefined): string {
  if (!summary) return "";
  const parts: string[] = [];
  const overview = asText(summary.overview || summary.short_summary || summary.short_overview || summary.gist);
  if (overview) parts.push(overview);
  const outline = asText(summary.outline || summary.shorthand_bullet);
  if (outline && outline !== overview) parts.push(outline);
  const actions = asLines(summary.action_items);
  if (actions) parts.push(`Action items:\n${actions}`);
  return parts.join("\n\n").trim();
}

export function formatFirefliesTranscript(sentences: FirefliesSentence[] | null | undefined): string {
  return (sentences || [])
    .map((row) => {
      const text = asText(row.text);
      if (!text) return "";
      const speaker = asText(row.speaker_name);
      return speaker ? `${speaker}: ${text}` : text;
    })
    .filter(Boolean)
    .join("\n");
}

export function firefliesMeetingAt(value: number | string | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const date = new Date(ms);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }
  const text = asText(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) return firefliesMeetingAt(Number(text));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isPdfUrl(url: string | null | undefined): boolean {
  return /\.pdf(?:$|[?#])/i.test(asText(url));
}

async function firefliesGraphql<T>(apiKey: string, query: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(FIREFLIES_GRAPHQL_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  const payload = (await response.json().catch(() => null)) as { data?: T; errors?: Array<{ message?: string }> } | null;
  if (!response.ok) throw new Error(`Fireflies API ${response.status}`);
  if (payload?.errors?.length) throw new Error(payload.errors[0]?.message || "Fireflies GraphQL error.");
  if (!payload?.data) throw new Error("Fireflies returned no data.");
  return payload.data;
}

export async function fetchFirefliesTranscript(apiKey: string, meetingId: string): Promise<FirefliesTranscript | null> {
  const data = await firefliesGraphql<{ transcript: FirefliesTranscript | null }>(apiKey, TRANSCRIPT_QUERY, {
    transcriptId: meetingId,
  });
  return data.transcript || null;
}

export async function testFirefliesApiKey(apiKey: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await firefliesGraphql(apiKey, "query { user { email name } }", {});
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not reach Fireflies." };
  }
}

export async function resolveFirefliesApiKey(): Promise<string> {
  return (await loadSettings()).apiKey;
}

async function loadSettings(): Promise<{ apiKey: string; webhookSecret: string; envApiKey: boolean; envWebhookSecret: boolean }> {
  const envApiKey = asText(process.env.FIREFLIES_API_KEY);
  const envWebhookSecret = asText(process.env.FIREFLIES_WEBHOOK_SECRET);
  const client = getServiceSupabase();
  let storedKey = "";
  let storedSecret = "";
  if (client) {
    const { data } = await client.from("fireflies_settings").select("api_key, webhook_secret").eq("id", 1).maybeSingle();
    storedKey = asText(data?.api_key);
    storedSecret = asText(data?.webhook_secret);
  }
  return {
    apiKey: firefliesApiKeyFrom(envApiKey, storedKey),
    webhookSecret: envWebhookSecret || storedSecret,
    envApiKey: Boolean(envApiKey),
    envWebhookSecret: Boolean(envWebhookSecret),
  };
}

export async function getFirefliesSettings(): Promise<{
  apiKeySet: boolean;
  apiKeyHint: string;
  webhookSecret: string;
  webhookSecretSet: boolean;
  webhookUrl: string;
  envApiKey: boolean;
  envWebhookSecret: boolean;
}> {
  const settings = await loadSettings();
  return {
    apiKeySet: Boolean(settings.apiKey),
    apiKeyHint: maskSecret(settings.apiKey),
    webhookSecret: settings.envWebhookSecret ? "" : settings.webhookSecret,
    webhookSecretSet: Boolean(settings.webhookSecret),
    webhookUrl: firefliesWebhookUrl(),
    envApiKey: settings.envApiKey,
    envWebhookSecret: settings.envWebhookSecret,
  };
}

export async function saveFirefliesSettings(input: {
  apiKey?: string | null;
  webhookSecret?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const client = getServiceSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const current = await loadSettings();
  const apiKey = asText(input.apiKey) || current.apiKey;
  const webhookSecret = asText(input.webhookSecret) || current.webhookSecret || generateFirefliesWebhookSecret();
  const { error } = await client.from("fireflies_settings").upsert({
    id: 1,
    api_key: apiKey || null,
    webhook_secret: webhookSecret || null,
    updated_at: new Date().toISOString(),
  });
  if (error) {
    const message = error.message || "";
    return {
      ok: false,
      error: /does not exist|schema cache/i.test(message) ? FIREFLIES_SQL_HINT : message,
    };
  }
  return { ok: true };
}

export async function listFirefliesImports(): Promise<
  Array<{
    id: string;
    meetingId: string;
    event: string;
    title: string;
    studentId: string | null;
    status: FirefliesImportStatus;
    attendeeEmails: string[];
    error: string;
    createdAt: string;
  }>
> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("fireflies_imports")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) return [];
  return ((data || []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    meetingId: asText(row.meeting_id),
    event: asText(row.event),
    title: asText(row.title),
    studentId: asText(row.student_id) || null,
    status: (asText(row.status) as FirefliesImportStatus) || "imported",
    attendeeEmails: Array.isArray(row.attendee_emails) ? row.attendee_emails.map((item) => String(item)) : [],
    error: asText(row.error),
    createdAt: asText(row.created_at),
  }));
}

async function logImport(row: {
  meetingId: string;
  event: string;
  title?: string;
  studentId?: string | null;
  status: FirefliesImportStatus;
  attendeeEmails?: string[];
  error?: string;
}) {
  const client = getServiceSupabase();
  if (!client) return;
  await client.from("fireflies_imports").insert({
    meeting_id: row.meetingId,
    event: row.event,
    title: row.title || null,
    student_id: row.studentId || null,
    status: row.status,
    attendee_emails: row.attendeeEmails || [],
    error: row.error || null,
  });
}

async function loadStudents(): Promise<FirefliesStudentMatch[]> {
  const client = getServiceSupabase();
  if (!client) return [];
  const { data } = await client.from("profiles").select("id, email, full_name, role");
  return ((data || []) as Array<{ id?: string; email?: string | null; full_name?: string | null; role?: string | null }>)
    .filter((row) => row.id && !isCoachAccount(row))
    .map((row) => ({
      id: String(row.id),
      email: asText(row.email),
      fullName: asText(row.full_name),
    }));
}

function matchStudent(students: FirefliesStudentMatch[], transcript: FirefliesTranscript): { student: FirefliesStudentMatch | null; reason: string } {
  const emails = attendeeEmails(transcript);
  const guests = guestEmails(emails);
  const byEmail = students.filter((student) => guests.includes(normalizeEmail(student.email)));
  if (byEmail.length > 1) return { student: null, reason: "Several students were on this call, so it was left unmatched." };
  if (byEmail.length === 1) return { student: byEmail[0], reason: "" };
  const byName = uniqueNameMatch(students, attendeeNames(transcript), asText(transcript.title));
  if (byName) return { student: byName, reason: "" };
  return { student: null, reason: "No student email or name on the Fireflies meeting matched a profile." };
}

async function upsertCoachingSession(input: {
  studentId: string;
  meetingId: string;
  title: string;
  sessionAt: string | null;
  summary: string;
  transcript: string;
  transcriptUrl: string;
  recordingUrl: string;
}) {
  const client = getServiceSupabase();
  if (!client) throw new Error("Supabase is not configured.");
  const { data: existingByMeeting } = await client
    .from("student_coaching_sessions")
    .select("id, coach_notes")
    .eq("fireflies_meeting_id", input.meetingId)
    .maybeSingle();
  let existing = existingByMeeting as { id?: string; coach_notes?: string | null } | null;
  if (!existing && input.sessionAt) {
    const start = new Date(input.sessionAt).getTime() - 36 * 60 * 60 * 1000;
    const end = new Date(input.sessionAt).getTime() + 36 * 60 * 60 * 1000;
    const { data: nearby } = await client
      .from("student_coaching_sessions")
      .select("id, coach_notes, fireflies_meeting_id, session_at")
      .eq("student_id", input.studentId)
      .gte("session_at", new Date(start).toISOString())
      .lte("session_at", new Date(end).toISOString())
      .order("session_at", { ascending: false })
      .limit(1);
    existing = (nearby || [])[0] || null;
  }
  const patch = {
    student_id: input.studentId,
    status: "completed",
    session_at: input.sessionAt,
    title: input.title || "1-on-1 coaching",
    fireflies_meeting_id: input.meetingId,
    fireflies_transcript_url: input.transcriptUrl || null,
    fireflies_pdf_url: isPdfUrl(input.transcriptUrl) ? input.transcriptUrl : null,
    pdf_summary_url: isPdfUrl(input.transcriptUrl) ? input.transcriptUrl : input.transcriptUrl || null,
    recording_url: input.recordingUrl || null,
    vimeo_recording_url: input.recordingUrl || null,
    summary_text: input.summary || null,
    transcript_text: input.transcript || null,
    deliverables_seen_at: null,
    updated_at: new Date().toISOString(),
  };
  if (existing?.id) {
    const { error } = await client.from("student_coaching_sessions").update(patch).eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client.from("student_coaching_sessions").insert(patch);
  if (error) throw new Error(error.message);
}

export async function importFirefliesMeeting(meetingId: string, event = "meeting.transcribed"): Promise<{
  ok: boolean;
  status: FirefliesImportStatus;
  error?: string;
}> {
  const settings = await loadSettings();
  if (!settings.apiKey) return { ok: false, status: "error", error: "Fireflies API key is not set." };
  const transcript = await fetchFirefliesTranscript(settings.apiKey, meetingId);
  if (!transcript) {
    await logImport({ meetingId, event, status: "unmatched", error: "Fireflies had no transcript for that meeting yet." });
    return { ok: true, status: "unmatched" };
  }
  const students = await loadStudents();
  const match = matchStudent(students, transcript);
  const emails = attendeeEmails(transcript);
  const title = asText(transcript.title) || "1-on-1 coaching";
  if (!match.student) {
    await logImport({
      meetingId,
      event,
      title,
      status: "unmatched",
      attendeeEmails: emails,
      error: match.reason,
    });
    return { ok: true, status: "unmatched" };
  }
  await upsertCoachingSession({
    studentId: match.student.id,
    meetingId,
    title,
    sessionAt: firefliesMeetingAt(transcript.date),
    summary: formatFirefliesSummary(transcript.summary),
    transcript: formatFirefliesTranscript(transcript.sentences),
    transcriptUrl: asText(transcript.transcript_url),
    recordingUrl: asText(transcript.video_url) || asText(transcript.audio_url),
  });
  await logImport({
    meetingId,
    event,
    title,
    studentId: match.student.id,
    status: "imported",
    attendeeEmails: emails,
  });
  return { ok: true, status: "imported" };
}
