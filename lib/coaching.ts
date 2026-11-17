import { isoToSastDateAndTime, sastDateAndTimeToIso } from "./dates";
import { isUserId } from "./notifications";
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
  live_calendar_ics_url: string | null;
  live_calendar_tooltip_text: string;
}

export type CoachingSessionStatus = "scheduled" | "completed" | "cancelled";

export type CoachingPdfFile = { url: string; name: string };

export interface StudentCoachingSession {
  id: string;
  studentId: string;
  status: CoachingSessionStatus;
  sessionAt: string | null;
  title: string | null;
  firefliesMeetingId: string | null;
  firefliesPdfUrl: string | null;
  firefliesTranscriptUrl: string | null;
  googleEventId: string | null;
  meetingUrl: string | null;
  vimeoRecordingUrl: string | null;
  recordingUrl: string | null;
  pdfSummaryUrl: string | null;
  pdfFiles: CoachingPdfFile[];
  summaryText: string | null;
  transcriptText: string | null;
  coachNotes: string | null;
  deliverablesSeenAt: string | null;
}

export const COACHING_CONFIG_ID = 1;

export const DEFAULT_LIVE_CALENDAR_TOOLTIP =
  "Subscribing adds all live calls directly to your Apple, Google, or Outlook calendar. Any schedule updates or room changes will sync automatically.";

export const COACHING_BOOKING_NOTE =
  "Click on the link to find a time that works for you and book your session. Please note that you need to set up ONE session. Additional sessions will be agreed upon if they're needed and if you're submitting tasks.";

export const COACHING_BOOKING_URL = "https://calendar.app.google/2bPLVu1Vdnh7LpMh7";

export const DEFAULT_COACHING_CONFIG: CoachingPageConfig = {
  title: "1-on-1 Coaching Session",
  description:
    "Book a private session with Yvonne. After you meet, your Fireflies summary, recording, and coach notes will appear here.",
  calendly_url: COACHING_BOOKING_URL,
  banner_image_url: null,
  dashboard_banner_url: "/student-dashboard-banner.jpg",
  recording_section_title: "Session Recording and Notes",
  recording_section_description: "",
  recording_button_label: "Watch Meeting Recording",
  pdf_button_label: "Download Meeting Summary (PDF)",
  live_calendar_ics_url: null,
  live_calendar_tooltip_text: DEFAULT_LIVE_CALENDAR_TOOLTIP,
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

function asHttpUrl(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function looksLikePdf(url: string): boolean {
  return /\.pdf(?:$|[?#])/i.test(url);
}

export function pdfNameFromUrl(url: string): string {
  try {
    const path = new URL(url).pathname;
    const leaf = decodeURIComponent(path.split("/").filter(Boolean).pop() || "");
    return leaf.replace(/^\d+-/, "") || "PDF";
  } catch {
    return "PDF";
  }
}

export function parseCoachingPdfFiles(value: unknown): CoachingPdfFile[] {
  if (!Array.isArray(value)) return [];
  const files: CoachingPdfFile[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const raw = (item as { url?: unknown }).url;
    const url = typeof raw === "string" ? asHttpUrl(raw) : null;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    const name = asText((item as { name?: unknown }).name) || pdfNameFromUrl(url);
    files.push({ url, name });
  }
  return files;
}

export function coachingPdfFiles(session: Pick<StudentCoachingSession, "pdfFiles" | "pdfSummaryUrl" | "firefliesPdfUrl">): CoachingPdfFile[] {
  const files: CoachingPdfFile[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined, name?: string | null) => {
    if (!url || seen.has(url) || !looksLikePdf(url)) return;
    seen.add(url);
    files.push({ url, name: name?.trim() || pdfNameFromUrl(url) });
  };
  for (const file of session.pdfFiles || []) add(file.url, file.name);
  add(session.pdfSummaryUrl);
  add(session.firefliesPdfUrl);
  return files;
}

export function transcriptSearchParts(text: string, query: string): Array<{ text: string; match: boolean }> {
  const source = String(text || "");
  const needle = query.trim();
  if (!source) return [];
  if (!needle) return [{ text: source, match: false }];
  const lower = source.toLowerCase();
  const find = needle.toLowerCase();
  const parts: Array<{ text: string; match: boolean }> = [];
  let index = 0;
  while (index < source.length) {
    const at = lower.indexOf(find, index);
    if (at < 0) {
      parts.push({ text: source.slice(index), match: false });
      break;
    }
    if (at > index) parts.push({ text: source.slice(index, at), match: false });
    parts.push({ text: source.slice(at, at + needle.length), match: true });
    index = at + needle.length;
  }
  return parts.filter((part) => part.text);
}

export function transcriptMatchCount(text: string, query: string): number {
  return transcriptSearchParts(text, query).filter((part) => part.match).length;
}

function sessionFromRow(row: Record<string, unknown>): StudentCoachingSession {
  return {
    id: String(row.id),
    studentId: String(row.student_id),
    status: asStatus(row.status),
    sessionAt: asTimestamp(row.session_at),
    title: asText(row.title),
    firefliesMeetingId: asText(row.fireflies_meeting_id),
    firefliesPdfUrl: asText(row.fireflies_pdf_url) || asText(row.pdf_summary_url),
    firefliesTranscriptUrl: asText(row.fireflies_transcript_url),
    googleEventId: asText(row.google_event_id),
    meetingUrl: asText(row.meeting_url),
    vimeoRecordingUrl: asText(row.vimeo_recording_url) || asText(row.recording_url),
    recordingUrl: asText(row.recording_url) || asText(row.vimeo_recording_url),
    pdfSummaryUrl: asText(row.pdf_summary_url) || asText(row.fireflies_pdf_url),
    pdfFiles: parseCoachingPdfFiles(row.pdf_files),
    summaryText: asText(row.summary_text),
    transcriptText: asText(row.transcript_text),
    coachNotes: asText(row.coach_notes),
    deliverablesSeenAt: asText(row.deliverables_seen_at),
  };
}

function tableMissing(message: string): boolean {
  return /does not exist|schema cache|could not find/i.test(message);
}

export function sessionHasDeliverables(
  session: Pick<
    StudentCoachingSession,
    | "recordingUrl"
    | "pdfSummaryUrl"
    | "pdfFiles"
    | "summaryText"
    | "transcriptText"
    | "firefliesTranscriptUrl"
    | "coachNotes"
  >
): boolean {
  return Boolean(
    session.recordingUrl ||
      session.pdfSummaryUrl ||
      session.pdfFiles?.length ||
      session.summaryText ||
      session.transcriptText ||
      session.firefliesTranscriptUrl ||
      session.coachNotes
  );
}

export function sessionHasUnseenDeliverables(session: StudentCoachingSession): boolean {
  return session.status === "completed" && sessionHasDeliverables(session) && !session.deliverablesSeenAt;
}

export function sessionCountsAsBooked(session: Pick<StudentCoachingSession, "status">): boolean {
  return session.status === "scheduled" || session.status === "completed";
}

export function studentCanBookOneOnOne(sessions: Array<Pick<StudentCoachingSession, "status">>): boolean {
  return !sessions.some(sessionCountsAsBooked);
}

export function bookedOneOnOneSession(
  sessions: StudentCoachingSession[]
): StudentCoachingSession | null {
  return bookedCoachingSessions(sessions)[0] || null;
}

export function bookedCoachingSessions(sessions: StudentCoachingSession[]): StudentCoachingSession[] {
  return sessions
    .filter(sessionCountsAsBooked)
    .sort((a, b) => {
      if (a.status !== b.status) return a.status === "scheduled" ? -1 : 1;
      if (a.status === "scheduled") return String(a.sessionAt || "").localeCompare(String(b.sessionAt || ""));
      return String(b.sessionAt || "").localeCompare(String(a.sessionAt || ""));
    });
}

export function coachingSessionStatusLabel(status: CoachingSessionStatus): string {
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Scheduled";
}

export function coachingBookingUrl(value: unknown): string {
  const url = asText(value);
  if (!url || /calendly\.com/i.test(url)) return COACHING_BOOKING_URL;
  return url;
}

function configFromRow(row: Record<string, unknown>): CoachingPageConfig {
  return {
    title: String(row.title || DEFAULT_COACHING_CONFIG.title),
    description: String(row.description || ""),
    calendly_url: coachingBookingUrl(row.calendly_url),
    banner_image_url: asText(row.banner_image_url),
    dashboard_banner_url: asText(row.dashboard_banner_url) || asText(row.dashboard_banner),
    recording_section_title: asText(row.recording_section_title) || DEFAULT_COACHING_CONFIG.recording_section_title,
    recording_section_description: asText(row.recording_section_description) || "",
    recording_button_label: asText(row.recording_button_label) || DEFAULT_COACHING_CONFIG.recording_button_label,
    pdf_button_label: asText(row.pdf_button_label) || DEFAULT_COACHING_CONFIG.pdf_button_label,
    live_calendar_ics_url: asText(row.live_calendar_ics_url),
    live_calendar_tooltip_text: asText(row.live_calendar_tooltip_text) || DEFAULT_LIVE_CALENDAR_TOOLTIP,
  };
}

export async function fetchCoachingPageConfig(): Promise<CoachingPageConfig> {
  const client = getSupabase();
  if (!client) return DEFAULT_COACHING_CONFIG;
  const { data, error } = await client
    .from("coaching_page_config")
    .select("*")
    .eq("id", COACHING_CONFIG_ID)
    .maybeSingle();
  if (error) {
    if (!tableMissing(error.message)) console.error("coaching_page_config", error.message);
    return DEFAULT_COACHING_CONFIG;
  }
  if (!data) return DEFAULT_COACHING_CONFIG;
  return configFromRow(data as Record<string, unknown>);
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

export type CoachingSessionWrite = {
  id?: string;
  studentId: string;
  title: string;
  date: string;
  recordingUrl: string;
  pdfSummaryUrl: string;
  executiveSummary: string;
  pdfFiles: CoachingPdfFile[];
};

export function emptyCoachingSessionWrite(studentId: string): CoachingSessionWrite {
  return {
    studentId,
    title: "",
    date: "",
    recordingUrl: "",
    pdfSummaryUrl: "",
    executiveSummary: "",
    pdfFiles: [],
  };
}

export function coachingSessionToWrite(session: StudentCoachingSession): CoachingSessionWrite {
  const pdfFiles = coachingPdfFiles(session);
  return {
    id: session.id,
    studentId: session.studentId,
    title: session.title || "",
    date: isoToSastDateAndTime(session.sessionAt).date,
    recordingUrl: session.recordingUrl || "",
    pdfSummaryUrl: pdfFiles[0]?.url || "",
    executiveSummary: session.coachNotes || "",
    pdfFiles,
  };
}

export function missingCoachingColumn(message: string): string | null {
  const match =
    message.match(/Could not find the '([^']+)' column/i) ||
    message.match(/'([^']+)' column of '/i);
  return match?.[1] || null;
}

export function coachingSessionWriteRow(
  input: CoachingSessionWrite
): { ok: true; row: Record<string, unknown> } | { ok: false; error: string } {
  const studentId = input.studentId.trim();
  if (!isUserId(studentId)) return { ok: false, error: "Missing student." };
  const recordingUrl = asHttpUrl(input.recordingUrl);
  if (input.recordingUrl.trim() && !recordingUrl) {
    return { ok: false, error: "Paste a full recording URL, starting with https://." };
  }
  const pdfFiles = parseCoachingPdfFiles(input.pdfFiles);
  const typedPdfUrl = asHttpUrl(input.pdfSummaryUrl);
  if (input.pdfSummaryUrl.trim() && !typedPdfUrl) {
    return { ok: false, error: "The summary PDF URL looks invalid. Upload the file again." };
  }
  if (typedPdfUrl && looksLikePdf(typedPdfUrl) && !pdfFiles.some((file) => file.url === typedPdfUrl)) {
    pdfFiles.unshift({ url: typedPdfUrl, name: pdfNameFromUrl(typedPdfUrl) });
  }
  const executiveSummary = input.executiveSummary.trim();
  if (!recordingUrl && !pdfFiles.length && !executiveSummary) {
    return { ok: false, error: "Paste take-aways, upload a PDF, or add a recording link." };
  }
  const sessionAt = input.date.trim() ? sastDateAndTimeToIso(input.date, "12:00") : null;
  if (input.date.trim() && !sessionAt) return { ok: false, error: "That session date looks invalid." };
  const pdfSummaryUrl = pdfFiles[0]?.url || null;
  const row: Record<string, unknown> = {
    student_id: studentId,
    status: "completed",
    title: input.title.trim() || "1-on-1 coaching",
    recording_url: recordingUrl,
    vimeo_recording_url: recordingUrl,
    pdf_summary_url: pdfSummaryUrl,
    pdf_files: pdfFiles,
    coach_notes: executiveSummary || null,
    updated_at: new Date().toISOString(),
  };
  if (sessionAt) row.session_at = sessionAt;
  else if (!input.id) row.session_at = new Date().toISOString();
  return { ok: true, row };
}

export async function uploadCoachingSummaryPdf(
  studentId: string,
  file: File
): Promise<{ ok: true; url: string; name: string } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  if (!isUserId(studentId)) return { ok: false, error: "Missing student." };
  const original = file.name.trim() || "summary.pdf";
  const lower = original.toLowerCase();
  if (!file.size) return { ok: false, error: "That file looks empty. Choose the PDF again." };
  if (file.size > 50 * 1024 * 1024) return { ok: false, error: "That PDF is larger than 50 MB. Compress it, then try again." };
  if (!file.type.includes("pdf") && !lower.endsWith(".pdf")) return { ok: false, error: "Please upload a PDF file." };
  const safe = original.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "summary.pdf";
  const path = `coaching-sessions/${studentId}/${Date.now()}-${safe}`;
  const uploaded = await client.storage.from("course-pdfs").upload(path, file, {
    upsert: true,
    contentType: file.type || "application/pdf",
  });
  if (uploaded.error) return { ok: false, error: "Could not upload that PDF. Try again, or paste a public PDF URL." };
  const { data } = client.storage.from("course-pdfs").getPublicUrl(path);
  if (!data?.publicUrl) return { ok: false, error: "Could not get a URL for that PDF." };
  return { ok: true, url: data.publicUrl, name: original };
}

export async function saveManualCoachingSession(
  input: CoachingSessionWrite
): Promise<{ ok: true; session: StudentCoachingSession } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const built = coachingSessionWriteRow(input);
  if (built.ok === false) return built;
  const patch = { ...built.row };
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const result = input.id
      ? await client.from("student_coaching_sessions").update(patch).eq("id", input.id).eq("student_id", input.studentId).select("*").maybeSingle()
      : await client.from("student_coaching_sessions").insert(patch).select("*").maybeSingle();
    if (!result.error && result.data) return { ok: true, session: sessionFromRow(result.data as Record<string, unknown>) };
    const missing = missingCoachingColumn(result.error?.message || "");
    if (missing && missing in patch) {
      delete patch[missing];
      continue;
    }
    return { ok: false, error: result.error?.message || "Could not save that coaching session." };
  }
  return { ok: false, error: "Could not save that coaching session." };
}

export async function deleteCoachingSession(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = getSupabase();
  if (!client) return { ok: false, error: "Supabase is not configured." };
  const { error } = await client.from("student_coaching_sessions").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
