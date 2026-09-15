import { formatSastDateTime } from "./dates";
import { getSupabase } from "./supabase";

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

function sessionFromRow(row: Record<string, unknown>): LiveSession {
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

export function formatLiveSessionAt(iso: string | Date | null | undefined): string {
  return formatSastDateTime(iso);
}

export function liveSessionIsRecorded(session: LiveSession): boolean {
  return session.status === "completed" || Boolean(session.recordingUrl);
}

export async function fetchLiveSessions(): Promise<LiveSession[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client.from("live_sessions").select("*").order("session_at", { ascending: true });
  if (error) {
    if (!tableMissing(error.message)) console.error("live_sessions", error.message);
    return [];
  }
  return ((data || []) as Record<string, unknown>[]).map(sessionFromRow);
}
