import { addDays, formatSastDateTime, isoDate, isoToSastDateAndTime, parseISO, sastDateAndTimeToIso } from "./dates";
import { isUserId } from "./notifications";
import type { CommunicationAudience } from "./types";

export const SCHEDULED_SEND_SQL_HINT =
  "Paste supabase/scheduled-sends.sql in the Supabase SQL editor, then try again.";

export const SCHEDULE_MODES = ["now", "at_time", "lesson_completed", "task_submitted"] as const;
export const SCHEDULED_CHANNELS = ["notification", "message"] as const;
export const SCHEDULED_TRIGGERS = ["at_time", "lesson_completed", "task_submitted"] as const;

export type ScheduleMode = (typeof SCHEDULE_MODES)[number];
export type ScheduledChannel = (typeof SCHEDULED_CHANNELS)[number];
export type ScheduledTrigger = (typeof SCHEDULED_TRIGGERS)[number];

export type ScheduledRecipient = { id: string; email: string; name: string };

export type ScheduleFields = {
  mode: ScheduleMode;
  sendAtDate: string;
  sendAtTime: string;
  lessonId: string;
  taskId: string;
};

export type ScheduledSend = {
  id: string;
  channel: ScheduledChannel;
  messageKind: "reply" | "feedback";
  title: string;
  body: string;
  pdfUrl: string;
  pdfName: string;
  audience: CommunicationAudience;
  audienceLabel: string;
  recipients: ScheduledRecipient[];
  trigger: ScheduledTrigger;
  sendAt: string | null;
  lessonId: string | null;
  taskId: string | null;
  createdAt: string;
  cancelledAt: string | null;
  deliveredCount: number;
};

export type ScheduledSendWrite = {
  channel: ScheduledChannel;
  messageKind?: "reply" | "feedback";
  title?: string;
  body: string;
  pdfUrl?: string;
  pdfName?: string;
  audience?: CommunicationAudience;
  audienceLabel?: string;
  recipients: ScheduledRecipient[];
  trigger: ScheduledTrigger;
  sendAt?: string | null;
  lessonId?: string | null;
  taskId?: string | null;
};

export function isScheduleMode(value: unknown): value is ScheduleMode {
  return SCHEDULE_MODES.includes(value as ScheduleMode);
}

export function isScheduledTrigger(value: unknown): value is ScheduledTrigger {
  return SCHEDULED_TRIGGERS.includes(value as ScheduledTrigger);
}

export function isScheduledChannel(value: unknown): value is ScheduledChannel {
  return SCHEDULED_CHANNELS.includes(value as ScheduledChannel);
}

export function defaultSendAtSast(): { date: string; time: string } {
  const today = isoToSastDateAndTime(new Date()).date || isoDate(new Date());
  return { date: isoDate(addDays(parseISO(today), 1)), time: "08:00" };
}

export function emptyScheduleFields(): ScheduleFields {
  const at = defaultSendAtSast();
  return { mode: "now", sendAtDate: at.date, sendAtTime: at.time, lessonId: "", taskId: "" };
}

export function scheduleModeLabel(mode: ScheduleMode): string {
  if (mode === "at_time") return "At a date and time";
  if (mode === "lesson_completed") return "When they complete a lesson";
  if (mode === "task_submitted") return "When they submit a Task";
  return "Send now";
}

export function scheduledSendDue(send: Pick<ScheduledSend, "trigger" | "sendAt" | "lessonId" | "taskId">, ctx: {
  now?: Date;
  completedLessonIds?: string[];
  submittedLessonIds?: string[];
}): boolean {
  if (send.trigger === "at_time") {
    if (!send.sendAt) return false;
    return (ctx.now || new Date()).getTime() >= new Date(send.sendAt).getTime();
  }
  if (send.trigger === "lesson_completed") {
    return Boolean(send.lessonId && (ctx.completedLessonIds || []).includes(send.lessonId));
  }
  return Boolean(send.taskId && (ctx.submittedLessonIds || []).includes(send.taskId));
}

export function scheduledTriggerLabel(
  send: Pick<ScheduledSend, "trigger" | "sendAt" | "lessonId" | "taskId">,
  labels?: { lessonTitle?: string; taskTitle?: string }
): string {
  if (send.trigger === "at_time") {
    return send.sendAt ? `At ${formatSastDateTime(send.sendAt)}` : "At a set time";
  }
  if (send.trigger === "lesson_completed") {
    return labels?.lessonTitle ? `When they complete ${labels.lessonTitle}` : "When they complete a lesson";
  }
  return labels?.taskTitle ? `When they submit ${labels.taskTitle}` : "When they submit a Task";
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

export function scheduledRecipientsFromUnknown(value: unknown): ScheduledRecipient[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const id = asText(item.id);
      const email = asText(item.email);
      if (!isUserId(id) || !email) return null;
      return { id, email, name: asText(item.name) || email };
    })
    .filter((row): row is ScheduledRecipient => Boolean(row));
}

export function scheduledSendFromRow(row: Record<string, unknown>, deliveredCount = 0): ScheduledSend | null {
  const id = asText(row.id);
  if (!id) return null;
  const trigger = isScheduledTrigger(row.trigger_type) ? row.trigger_type : "at_time";
  const channel = isScheduledChannel(row.channel) ? row.channel : "notification";
  return {
    id,
    channel,
    messageKind: asText(row.message_kind) === "feedback" ? "feedback" : "reply",
    title: asText(row.title),
    body: asText(row.body),
    pdfUrl: asText(row.pdf_url),
    pdfName: asText(row.pdf_name),
    audience: (asText(row.audience) as CommunicationAudience) || "student",
    audienceLabel: asText(row.audience_label),
    recipients: scheduledRecipientsFromUnknown(row.recipients),
    trigger,
    sendAt: asText(row.send_at) || null,
    lessonId: asText(row.lesson_id) || null,
    taskId: asText(row.task_id) || null,
    createdAt: asText(row.created_at),
    cancelledAt: asText(row.cancelled_at) || null,
    deliveredCount,
  };
}

export function validateScheduledSendWrite(
  input: ScheduledSendWrite
): { ok: true; write: ScheduledSendWrite } | { ok: false; error: string } {
  const body = asText(input.body);
  const pdfUrl = asText(input.pdfUrl);
  if (!body && !pdfUrl) return { ok: false, error: "Write a message or attach a PDF." };
  if (!isScheduledChannel(input.channel)) return { ok: false, error: "Choose notification or message." };
  if (!isScheduledTrigger(input.trigger)) return { ok: false, error: "Choose when this should send." };
  const recipients = input.recipients.filter((row) => isUserId(row.id) && row.email);
  if (!recipients.length) return { ok: false, error: "Pick at least one student." };
  if (input.channel === "notification" && !asText(input.title)) {
    return { ok: false, error: "Add a subject for this notification." };
  }

  const write: ScheduledSendWrite = {
    channel: input.channel,
    messageKind: input.messageKind === "feedback" ? "feedback" : "reply",
    title: asText(input.title) || (input.channel === "message" ? "Message from your coach" : ""),
    body,
    pdfUrl,
    pdfName: asText(input.pdfName),
    audience: input.audience || (recipients.length > 1 ? "filtered" : "student"),
    audienceLabel: asText(input.audienceLabel) || (recipients.length === 1 ? recipients[0].name : `${recipients.length} students`),
    recipients,
    trigger: input.trigger,
    sendAt: null,
    lessonId: null,
    taskId: null,
  };

  if (input.trigger === "at_time") {
    const sendAt = asText(input.sendAt);
    if (!sendAt) return { ok: false, error: "Choose the date and time this should send." };
    write.sendAt = sendAt;
  } else if (input.trigger === "lesson_completed") {
    const lessonId = asText(input.lessonId);
    if (!lessonId) return { ok: false, error: "Choose the lesson that should send this." };
    write.lessonId = lessonId;
  } else {
    const taskId = asText(input.taskId);
    if (!taskId) return { ok: false, error: "Choose the Task that should send this." };
    write.taskId = taskId;
  }

  return { ok: true, write };
}

export function scheduledWriteFromFields(
  fields: ScheduleFields,
  rest: Omit<ScheduledSendWrite, "trigger" | "sendAt" | "lessonId" | "taskId">
): { ok: true; write: ScheduledSendWrite } | { ok: false; error: string } | { ok: true; now: true } {
  if (fields.mode === "now") return { ok: true, now: true };
  const sendAt =
    fields.mode === "at_time" ? sastDateAndTimeToIso(fields.sendAtDate, fields.sendAtTime) : null;
  if (fields.mode === "at_time" && !sendAt) return { ok: false, error: "Choose a valid date and time in SAST." };
  return validateScheduledSendWrite({
    ...rest,
    trigger: fields.mode,
    sendAt,
    lessonId: fields.lessonId,
    taskId: fields.taskId,
  });
}

export function scheduledTableMissing(message: string): boolean {
  return /scheduled_sends|scheduled_send_deliveries|does not exist|schema cache|could not find/i.test(message);
}

export async function listScheduledSends(): Promise<{ ok: boolean; data: ScheduledSend[]; error?: string }> {
  try {
    const response = await fetch("/api/coach/scheduled-sends");
    const payload = (await response.json().catch(() => ({}))) as { data?: ScheduledSend[]; error?: string };
    if (!response.ok) return { ok: false, data: [], error: payload.error || SCHEDULED_SEND_SQL_HINT };
    return { ok: true, data: payload.data || [] };
  } catch (error) {
    return { ok: false, data: [], error: error instanceof Error ? error.message : SCHEDULED_SEND_SQL_HINT };
  }
}

export const SCHEDULED_SENDS_CHANGED = "scheduled-sends-changed";

export function notifyScheduledSendsChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SCHEDULED_SENDS_CHANGED));
}

export function scheduledSendFinished(send?: ScheduledSend | null): boolean {
  if (!send) return false;
  return send.recipients.length > 0 && send.deliveredCount >= send.recipients.length;
}

export async function createScheduledSend(
  write: ScheduledSendWrite
): Promise<{ ok: boolean; data?: ScheduledSend; error?: string }> {
  try {
    const response = await fetch("/api/coach/scheduled-sends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", send: write }),
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: ScheduledSend; error?: string };
    if (!response.ok) return { ok: false, error: payload.error || SCHEDULED_SEND_SQL_HINT };
    notifyScheduledSendsChanged();
    return { ok: true, data: payload.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : SCHEDULED_SEND_SQL_HINT };
  }
}

export async function cancelScheduledSend(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/coach/scheduled-sends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", id }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) return { ok: false, error: payload.error || "Could not cancel that send." };
    notifyScheduledSendsChanged();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not cancel that send." };
  }
}

export async function deliverDueScheduledSends(): Promise<{ ok: boolean; inserted?: number; error?: string }> {
  try {
    const response = await fetch("/api/coach/scheduled-sends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "deliver" }),
    });
    const payload = (await response.json().catch(() => ({}))) as { inserted?: number; error?: string };
    if (!response.ok) return { ok: false, error: payload.error };
    return { ok: true, inserted: payload.inserted || 0 };
  } catch {
    return { ok: true, inserted: 0 };
  }
}
