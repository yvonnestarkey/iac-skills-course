import { getSupabase } from "./supabase";
import { fetchStudentProfiles } from "./profiles";
import type { CommunicationAudience } from "./types";

export type NotificationType = "announcement" | "assignment_feedback";

export interface StudentNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  created_at: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUserId(value: string | null | undefined): value is string {
  return Boolean(value && UUID.test(value));
}

function describe(error: { message?: string; hint?: string; code?: string }): string {
  const parts = [error.message || "Unknown error"];
  if (error.code) parts.push(`(${error.code})`);
  if (error.hint) parts.push(error.hint);
  return parts.join(" ");
}

export function notificationFromRow(row: NotificationRow | Record<string, unknown> | null | undefined): StudentNotification | null {
  if (!row || typeof row !== "object") return null;
  const data = row as NotificationRow;
  const id = data.id != null ? String(data.id) : "";
  if (!id || id === "undefined" || id === "null") return null;
  return {
    id,
    userId: data.user_id != null ? String(data.user_id) : "",
    title: String(data.title || ""),
    message: String(data.message || ""),
    type: data.type === "assignment_feedback" ? "assignment_feedback" : "announcement",
    read: Boolean(data.read),
    createdAt: String(data.created_at || ""),
  };
}

export function asNotificationList(value: unknown): StudentNotification[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => (row && typeof row === "object" && "id" in row && "title" in row ? (row as StudentNotification) : notificationFromRow(row as NotificationRow)))
    .filter((item): item is StudentNotification => Boolean(item?.id));
}

async function authClient() {
  const client = getSupabase();
  if (!client) return { client: null, user: null, error: "Supabase is not configured." };
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { client, user: null, error: "Sign in required." };
  return { client, user: data.user, error: null };
}

export async function fetchOwnNotifications(): Promise<{
  ok: boolean;
  error?: string;
  data: StudentNotification[];
}> {
  try {
    const { client, user, error: authError } = await authClient();
    if (!client || !user) return { ok: false, error: authError || "Sign in required.", data: [] };

    const { data, error } = await client
      .from("notifications")
      .select("id, user_id, title, message, type, read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: describe(error), data: [] };
    return { ok: true, data: asNotificationList((data || []).map((row) => notificationFromRow(row as NotificationRow))) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not load notifications.", data: [] };
  }
}

export async function fetchUnreadNotifications(userId: string): Promise<{
  ok: boolean;
  error?: string;
  data: StudentNotification[];
}> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required.", data: [] };

  const { data, error } = await client
    .from("notifications")
    .select("id, user_id, title, message, type, read, created_at")
    .eq("user_id", userId)
    .eq("read", false)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: describe(error), data: [] };
  return { ok: true, data: asNotificationList((data || []).map((row) => notificationFromRow(row as NotificationRow))) };
}

export async function markOwnNotificationsRead(): Promise<{ ok: boolean; error?: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client || !user) return { ok: false, error: authError || "Sign in required." };

  const { error } = await client.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
  if (error) return { ok: false, error: describe(error) };
  return { ok: true };
}

export async function insertNotifications(input: {
  userIds: string[];
  title: string;
  message: string;
  type: NotificationType;
}): Promise<{ ok: boolean; count: number; error?: string }> {
  const { client, user, error: authError } = await authClient();
  if (!client) return { ok: false, count: 0, error: authError || "Supabase is not configured." };
  if (!user) return { ok: false, count: 0, error: authError || "Sign in required." };

  const title = input.title.trim();
  const message = input.message.trim();
  const userIds = [...new Set(input.userIds.filter(isUserId))];
  if (!title || !message) return { ok: false, count: 0, error: "Write a title and message first." };
  if (!userIds.length) return { ok: false, count: 0, error: "No live students to notify." };

  const { error } = await client.from("notifications").insert(
    userIds.map((user_id) => ({
      user_id,
      title,
      message,
      type: input.type,
      read: false,
    }))
  );

  if (error) return { ok: false, count: 0, error: describe(error) };
  return { ok: true, count: userIds.length };
}

/** One-student assignment feedback from the coach inbox. */
export async function notifyAssignmentFeedback(input: {
  studentId?: string | null;
  studentEmail?: string;
  title: string;
  message: string;
}): Promise<{ ok: boolean; count: number; error?: string }> {
  let userId = input.studentId || "";
  if (!isUserId(userId) && input.studentEmail) {
    const client = getSupabase();
    if (client) {
      const { data } = await client.from("profiles").select("id").ilike("email", input.studentEmail).maybeSingle();
      userId = data?.id || "";
    }
  }
  if (!isUserId(userId)) return { ok: false, count: 0, error: "No student account to notify." };
  return insertNotifications({
    userIds: [userId],
    title: input.title,
    message: input.message,
    type: "assignment_feedback",
  });
}

/** Coach announcement: one row per recipient, or every active student for a broadcast. */
export async function deliverAnnouncement(input: {
  title: string;
  message: string;
  audience: CommunicationAudience;
  recipientIds: string[];
}): Promise<{ ok: boolean; count: number; error?: string }> {
  let userIds = [...new Set(input.recipientIds.filter(isUserId))];

  if (input.audience === "all" || (input.audience === "cohort" && !userIds.length)) {
    const roster = await fetchStudentProfiles();
    if (!roster.ok) return { ok: false, count: 0, error: roster.error || "Could not load students." };
    userIds = roster.data.map((row) => row.id);
  }

  return insertNotifications({
    userIds,
    title: input.title,
    message: input.message,
    type: "announcement",
  });
}
