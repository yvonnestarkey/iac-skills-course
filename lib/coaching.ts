import { getSupabase } from "./supabase";

export interface CoachingPageConfig {
  title: string;
  description: string;
  calendly_url: string | null;
  banner_image_url: string | null;
}

export type CoachingSessionStatus = "scheduled" | "completed" | "cancelled";

export interface StudentCoachingSession {
  id: string;
  studentId: string;
  status: CoachingSessionStatus;
  sessionAt: string | null;
  firefliesPdfUrl: string | null;
  vimeoRecordingUrl: string | null;
  coachNotes: string | null;
  deliverablesSeenAt: string | null;
}

export const DEFAULT_COACHING_CONFIG: CoachingPageConfig = {
  title: "1-on-1 Coaching Session",
  description:
    "Book a private session with Yvonne. After you meet, your Fireflies summary, recording, and coach notes will appear here.",
  calendly_url: null,
  banner_image_url: null,
};

function asStatus(value: unknown): CoachingSessionStatus {
  if (value === "completed" || value === "cancelled" || value === "scheduled") return value;
  return "scheduled";
}

function asText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text || null;
}

function sessionFromRow(row: Record<string, unknown>): StudentCoachingSession {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    status: asStatus(row.status),
    sessionAt: asText(row.session_at),
    firefliesPdfUrl: asText(row.fireflies_pdf_url),
    vimeoRecordingUrl: asText(row.vimeo_recording_url),
    coachNotes: asText(row.coach_notes),
    deliverablesSeenAt: asText(row.deliverables_seen_at),
  };
}

function tableMissing(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}

export function sessionHasDeliverables(session: StudentCoachingSession): boolean {
  return Boolean(session.firefliesPdfUrl || session.vimeoRecordingUrl || session.coachNotes);
}

export function sessionHasUnseenDeliverables(session: StudentCoachingSession): boolean {
  return session.status === "completed" && sessionHasDeliverables(session) && !session.deliverablesSeenAt;
}

export async function fetchCoachingPageConfig(): Promise<CoachingPageConfig> {
  const client = getSupabase();
  if (!client) return DEFAULT_COACHING_CONFIG;
  const { data, error } = await client
    .from("coaching_page_config")
    .select("title, description, calendly_url, banner_image_url")
    .eq("id", "default")
    .maybeSingle();
  if (error) {
    if (!tableMissing(error.message)) console.error(error.message);
    return DEFAULT_COACHING_CONFIG;
  }
  if (!data) return DEFAULT_COACHING_CONFIG;
  return {
    title: String(data.title || DEFAULT_COACHING_CONFIG.title),
    description: String(data.description || ""),
    calendly_url: asText(data.calendly_url),
    banner_image_url: asText(data.banner_image_url),
  };
}

export async function fetchStudentCoachingSessions(studentId: string): Promise<StudentCoachingSession[]> {
  const client = getSupabase();
  if (!client) return [];
  const { data, error } = await client
    .from("student_coaching_sessions")
    .select("*")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });
  if (error) {
    if (!tableMissing(error.message)) console.error(error.message);
    return [];
  }
  return ((data || []) as Record<string, unknown>[]).map(sessionFromRow);
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
