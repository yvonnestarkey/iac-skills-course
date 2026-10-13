import { formatSastDateTime, isoToSastDateAndTime, sastDateAndTimeToIso } from "./dates";
import { getSupabase } from "./supabase";

export const LIVE_SESSIONS_SQL_HINT = "Paste supabase/live-sessions-access.sql in the Supabase SQL editor, then try again.";

export type LiveSessionWrite = {
  id?: string;
  title: string;
  description: string;
  date: string;
  time: string;
  status: LiveSessionStatus;
  zoomUrl: string;
  recordingUrl: string;
  summaryPdfUrl: string;
  notesPdfUrl: string;
};

export type LiveSessionStatus = "upcoming" | "completed" | "cancelled";

export interface LiveSession {
  id: string;
  title: string;
  description: string;
  sessionAt: string | null;
  status: LiveSessionStatus;
  zoomUrl: string | null;
  recordingUrl: string | null;
  summaryPdfUrl: string | null;
  notesPdfUrl: string | null;
}

function asText(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    return text || null;
  }
  return null;
}

function asTimestamp(value: unknown): string | null {
  if (typeof value === "string") return asText(value);
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return null;
}

function asStatus(value: unknown): LiveSessionStatus {
  if (value === "completed" || value === "cancelled" || value === "upcoming") return value;
  if (value === "scheduled") return "upcoming";
  return "upcoming";
}

function tableMissing(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}

function liveSessionError(message: string): string {
  if (tableMissing(message) || /row-level security|not allowed|policy|unauthorized|403/i.test(message)) {
    return LIVE_SESSIONS_SQL_HINT;
  }
  return message || "Could not save that live session.";
}

export function sessionFromRow(row: Record<string, unknown>): LiveSession {
  return {
    id: String(row.id),
    title: asText(row.title) || "Live session",
    description: asText(row.description) || "",
    sessionAt: asTimestamp(row.session_at),
    status: asStatus(row.status),
    zoomUrl: asText(row.zoom_url),
    recordingUrl: asText(row.recording_url),
    summaryPdfUrl: asText(row.summary_pdf_url),
    notesPdfUrl: asText(row.notes_pdf_url),
  };
}

export function emptyLiveSessionWrite(): LiveSessionWrite {
  return {
    title: "",
    description: "",
    date: "",
    time: "18:00",
    status: "upcoming",
    zoomUrl: "",
    recordingUrl: "",
    summaryPdfUrl: "",
    notesPdfUrl: "",
  };
}

export function liveSessionToWrite(session: LiveSession): LiveSessionWrite {
  const when = isoToSastDateAndTime(session.sessionAt);
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    date: when.date,
    time: when.time || "18:00",
    status: session.status,
    zoomUrl: session.zoomUrl || "",
    recordingUrl: session.recordingUrl || "",
    summaryPdfUrl: session.summaryPdfUrl || "",
    notesPdfUrl: session.notesPdfUrl || "",
  };
}

/** Build the live_sessions row. Recording URL marks the session completed unless cancelled. */
export function liveSessionWriteRow(input: LiveSessionWrite): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const title = input.title.trim();
  if (!title) return { ok: false, error: "Give the session a title." };
  const sessionAt = sastDateAndTimeToIso(input.date, input.time);
  if (!sessionAt) return { ok: false, error: "Set the date and time in SAST." };
  const recordingUrl = asText(input.recordingUrl);
  const status: LiveSessionStatus =
    input.status === "cancelled" ? "cancelled" : recordingUrl ? "completed" : asStatus(input.status);
  return {
    ok: true,
    row: {
      title,
      description: input.description.trim(),
      session_at: sessionAt,
      status,
      zoom_url: asText(input.zoomUrl),
      recording_url: recordingUrl,
      summary_pdf_url: asText(input.summaryPdfUrl),
      notes_pdf_url: asText(input.notesPdfUrl),
      updated_at: new Date().toISOString(),
    },
  };
}

export function formatLiveSessionAt(iso: string | Date | null | undefined): string {
  return formatSastDateTime(iso);
}

export function liveSessionIsRecorded(session: LiveSession): boolean {
  return session.status === "completed" || Boolean(session.recordingUrl);
}

export function canAccessAllLiveSessionLinks(entitlement: string | null | undefined): boolean {
  return entitlement === "full" || entitlement === "staff";
}

export function firstLiveSessionId(sessions: LiveSession[]): string | null {
  const ordered = [...sessions].sort((left, right) => {
    const byTime = (left.sessionAt || "").localeCompare(right.sessionAt || "");
    return byTime || left.id.localeCompare(right.id);
  });
  return ordered[0]?.id || null;
}

/** Preview students keep the first session's recording only. Full/staff keep every link. */
export function sanitizeLiveSessionLinks(
  session: LiveSession,
  input: { fullAccess: boolean; firstSessionId: string | null }
): LiveSession {
  if (input.fullAccess) return session;
  return {
    ...session,
    zoomUrl: null,
    summaryPdfUrl: null,
    notesPdfUrl: null,
    recordingUrl: session.id === input.firstSessionId ? session.recordingUrl : null,
  };
}

export function sanitizeLiveSessionsForAccess(sessions: LiveSession[], entitlement: string | null | undefined): LiveSession[] {
  const firstSessionId = firstLiveSessionId(sessions);
  const fullAccess = canAccessAllLiveSessionLinks(entitlement);
  return sessions.map((session) => sanitizeLiveSessionLinks(session, { fullAccess, firstSessionId }));
}

export async function fetchLiveSessions(): Promise<LiveSession[]> {
  const client = getSupabase();
  if (!client) return [];
  const rpc = await client.rpc("list_live_sessions_for_student");
  if (!rpc.error) return ((rpc.data || []) as Record<string, unknown>[]).map(sessionFromRow);
  const listed = await listLiveSessions();
  return listed.ok ? listed.sessions : [];
}

export async function listLiveSessions(): Promise<{ ok: true; sessions: LiveSession[] } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { data, error } = await client.from("live_sessions").select("*").order("session_at", { ascending: true });
  if (error) return { ok: false, error: liveSessionError(error.message) };
  return { ok: true, sessions: ((data || []) as Record<string, unknown>[]).map(sessionFromRow) };
}

export async function saveLiveSession(input: LiveSessionWrite): Promise<{ ok: true; session: LiveSession } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const built = liveSessionWriteRow(input);
  if (built.ok === false) return { ok: false, error: built.error };
  const query = input.id
    ? client.from("live_sessions").update(built.row).eq("id", input.id).select("*").maybeSingle()
    : client.from("live_sessions").insert(built.row).select("*").maybeSingle();
  const { data, error } = await query;
  if (error || !data) return { ok: false, error: liveSessionError(error?.message || "Could not save that live session.") };
  return { ok: true, session: sessionFromRow(data as Record<string, unknown>) };
}

export async function deleteLiveSession(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("live_sessions").delete().eq("id", id);
  if (error) return { ok: false, error: liveSessionError(error.message) };
  return { ok: true };
}

export async function uploadLiveSessionPdf(file: File, kind: "summary" | "notes"): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const name = file.name.toLowerCase();
  if (!file.type.includes("pdf") && !name.endsWith(".pdf")) {
    return { ok: false, error: "Please upload a PDF file." };
  }
  const path = `live-sessions/${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
  const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: "Could not upload that PDF. Paste a public PDF URL instead." };
  const { data } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a public URL for that PDF." };
  return { ok: true, url: data.publicUrl };
}
