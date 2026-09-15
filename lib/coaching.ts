import { getSupabase } from "./supabase";

export interface CoachingPageConfig {
  title: string;
  description: string;
  calendly_url: string;
  banner_image_url: string | null;
  dashboard_banner_url: string | null;
  recording_section_title: string;
  recording_section_description: string;
  recording_button_label: string;
  pdf_button_label: string;
}

export type CoachingSessionStatus = "scheduled" | "completed" | "cancelled";

export interface StudentCoachingSession {
  id: string;
  studentId: string;
  status: CoachingSessionStatus;
  sessionAt: string | null;
  firefliesPdfUrl: string | null;
  vimeoRecordingUrl: string | null;
  recordingUrl: string | null;
  pdfSummaryUrl: string | null;
  coachNotes: string | null;
  deliverablesSeenAt: string | null;
}

export const COACHING_CONFIG_ID = 1;

export const DEFAULT_COACHING_CONFIG: CoachingPageConfig = {
  title: "1-on-1 Coaching Session",
  description:
    "Book a private session with Yvonne. After you meet, your Fireflies summary, recording, and coach notes will appear here.",
  calendly_url: "",
  banner_image_url: null,
  dashboard_banner_url: null,
  recording_section_title: "Session Recording and Notes",
  recording_section_description: "",
  recording_button_label: "Watch Meeting Recording",
  pdf_button_label: "Download Meeting Summary (PDF)",
};

function asStatus(value: unknown): CoachingSessionStatus {
  if (value === "completed" || value === "cancelled" || value === "scheduled") return value;
  return "scheduled";
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

function sessionFromRow(row: Record<string, unknown>): StudentCoachingSession {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    status: asStatus(row.status),
    sessionAt: asTimestamp(row.session_at),
    firefliesPdfUrl: asText(row.fireflies_pdf_url) || asText(row.pdf_summary_url),
    vimeoRecordingUrl: asText(row.vimeo_recording_url) || asText(row.recording_url),
    recordingUrl: asText(row.recording_url) || asText(row.vimeo_recording_url),
    pdfSummaryUrl: asText(row.pdf_summary_url) || asText(row.fireflies_pdf_url),
    coachNotes: asText(row.coach_notes),
    deliverablesSeenAt: asText(row.deliverables_seen_at),
  };
}

function tableMissing(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}

export function sessionHasDeliverables(session: StudentCoachingSession): boolean {
  return Boolean(session.recordingUrl || session.pdfSummaryUrl || session.coachNotes);
}

export function sessionHasUnseenDeliverables(session: StudentCoachingSession): boolean {
  return session.status === "completed" && sessionHasDeliverables(session) && !session.deliverablesSeenAt;
}

export async function fetchCoachingPageConfig(): Promise<CoachingPageConfig> {
  const client = getSupabase();
  if (!client) return DEFAULT_COACHING_CONFIG;
  const CONFIG_COLUMNS =
    "title, description, calendly_url, banner_image_url, dashboard_banner_url, recording_section_title, recording_section_description, recording_button_label, pdf_button_label";
  let result = await client.from("coaching_page_config").select(CONFIG_COLUMNS).eq("id", COACHING_CONFIG_ID).maybeSingle();
  if (result.error && /could not find|schema cache|column/i.test(result.error.message)) {
    result = await client
      .from("coaching_page_config")
      .select("title, description, calendly_url, banner_image_url")
      .eq("id", COACHING_CONFIG_ID)
      .maybeSingle();
  }
  const { data, error } = result;
  if (error) {
    if (!tableMissing(error.message)) console.error(error.message);
    return DEFAULT_COACHING_CONFIG;
  }
  if (!data) return DEFAULT_COACHING_CONFIG;
  const row = data as Record<string, unknown>;
  return {
    title: String(row.title || DEFAULT_COACHING_CONFIG.title),
    description: String(row.description || ""),
    calendly_url: asText(row.calendly_url) || "",
    banner_image_url: asText(row.banner_image_url),
    dashboard_banner_url: asText(row.dashboard_banner_url),
    recording_section_title: asText(row.recording_section_title) || DEFAULT_COACHING_CONFIG.recording_section_title,
    recording_section_description: asText(row.recording_section_description) || "",
    recording_button_label: asText(row.recording_button_label) || DEFAULT_COACHING_CONFIG.recording_button_label,
    pdf_button_label: asText(row.pdf_button_label) || DEFAULT_COACHING_CONFIG.pdf_button_label,
  };
}

export async function fetchStudentCoachingSessions(studentId: string): Promise<StudentCoachingSession[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("student_coaching_sessions")
    .select("*")
    .eq("student_id", studentId)
    .order("session_at", { ascending: false });
  if (error) {
    if (!tableMissing(error.message)) console.error(error.message);
    return [];
  }
  return ((data || []) as Record<string, unknown>[]).map(sessionFromRow);
}

export async function fetchLatestStudentCoachingSession(studentId: string): Promise<StudentCoachingSession | null> {
  const sessions = await fetchStudentCoachingSessions(studentId);
  return sessions[0] || null;
}

export async function markCoachingDeliverablesSeen(studentId: string): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  const { error } = await client
    .from("student_coaching_sessions")
    .update({ deliverables_seen_at: new Date().toISOString() })
    .eq("student_id", studentId)
    .eq("status", "completed")
    .is("deliverables_seen_at", null);
  if (error && !tableMissing(error.message)) console.error(error.message);
}

export async function fetchCoachingDashboardHint(studentId: string): Promise<{ unseenDeliverables: boolean }> {
  const sessions = await fetchStudentCoachingSessions(studentId);
  return { unseenDeliverables: sessions.some(sessionHasUnseenDeliverables) };
}
