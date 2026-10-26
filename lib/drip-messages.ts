import { currentCohortId, displayCohortName, normalizeCohortId } from "./cohorts";
import { addDays, isoDate, isoToSastDateAndTime, parseISO } from "./dates";
import { isTaskChapter } from "./course-phases";

export const DRIP_TRIGGERS = ["enrolment_delay", "fixed_date", "lesson_completed", "task_completed"] as const;
export const DRIP_SCOPES = ["static", "cohort"] as const;
export const DRIP_CATEGORIES = ["enrolment", "date", "progress"] as const;
export const DRIP_DELAY_UNITS = ["days", "weeks", "months"] as const;

export type DripTrigger = (typeof DRIP_TRIGGERS)[number];
export type DripScope = (typeof DRIP_SCOPES)[number];
export type DripCategory = (typeof DRIP_CATEGORIES)[number];
export type DripDelayUnit = (typeof DRIP_DELAY_UNITS)[number];

export const DRIP_DELAY_PRESETS: { label: string; days: number }[] = [
  { label: "Day of", days: 0 },
  { label: "1 day after", days: 1 },
  { label: "1 week after", days: 7 },
  { label: "1 month after", days: 30 },
];

export interface DripMessage {
  id: string;
  title: string;
  body: string;
  trigger: DripTrigger;
  delayDays: number | null;
  sendOn: string | null;
  lessonId: string | null;
  taskId: string | null;
  scope: DripScope;
  cohortId: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  deliveryCount: number;
}

export interface DripWrite {
  id?: string;
  title: string;
  body: string;
  trigger: DripTrigger;
  delayDays?: number | null;
  sendOn?: string | null;
  lessonId?: string | null;
  taskId?: string | null;
  scope: DripScope;
  cohortId?: string | null;
  isActive?: boolean;
}

export interface DripStudentContext {
  userId: string;
  email: string;
  name?: string | null;
  cohort: string;
  enrolledAt: string;
  completedLessonIds: string[];
  taskLessonIds: string[];
}

export function isDripTrigger(value: unknown): value is DripTrigger {
  return DRIP_TRIGGERS.includes(value as DripTrigger);
}

export function isDripScope(value: unknown): value is DripScope {
  return DRIP_SCOPES.includes(value as DripScope);
}

export function dripCategory(trigger: DripTrigger | null | undefined): DripCategory {
  if (trigger === "fixed_date") return "date";
  if (trigger === "lesson_completed" || trigger === "task_completed") return "progress";
  return "enrolment";
}

export function dripCategoryLabel(category: DripCategory): string {
  if (category === "date") return "Specific Date";
  if (category === "progress") return "Course progress";
  return "Enrolment";
}

export function triggersForCategory(category: DripCategory): DripTrigger {
  if (category === "date") return "fixed_date";
  if (category === "progress") return "lesson_completed";
  return "enrolment_delay";
}

export function delayDaysFromParts(amount: number, unit: DripDelayUnit): number {
  const value = Math.max(0, Math.trunc(Number(amount) || 0));
  if (unit === "weeks") return value * 7;
  if (unit === "months") return value * 30;
  return value;
}

export function delayPartsFromDays(days: number | null | undefined): { amount: number; unit: DripDelayUnit } {
  const value = Math.max(0, Number(days) || 0);
  if (value === 0) return { amount: 0, unit: "days" };
  if (value % 30 === 0) return { amount: value / 30, unit: "months" };
  if (value % 7 === 0) return { amount: value / 7, unit: "weeks" };
  return { amount: value, unit: "days" };
}

export function emptyDripWrite(): DripWrite {
  return {
    title: "",
    body: "",
    trigger: "enrolment_delay",
    delayDays: 0,
    sendOn: "",
    lessonId: "",
    taskId: "",
    scope: "static",
    cohortId: currentCohortId(),
    isActive: true,
  };
}

export function dripWriteFromMessage(message: DripMessage): DripWrite {
  return {
    id: message.id,
    title: message.title,
    body: message.body,
    trigger: message.trigger,
    delayDays: message.delayDays,
    sendOn: message.sendOn || "",
    lessonId: message.lessonId || "",
    taskId: message.taskId || "",
    scope: message.scope,
    cohortId: message.cohortId || currentCohortId(),
    isActive: message.isActive,
  };
}

function asText(value: unknown): string {
  return String(value ?? "").trim();
}

function asOptionalText(value: unknown): string | null {
  const text = asText(value);
  return text || null;
}

function asDateOnly(value: unknown): string | null {
  const text = asText(value);
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return isoToSastDateAndTime(text).date || text.slice(0, 10) || null;
}

function asInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  return Math.trunc(next);
}

export function dripFromRow(row: Record<string, unknown> | null | undefined, deliveryCount = 0): DripMessage | null {
  if (!row || typeof row !== "object") return null;
  const id = asText(row.id);
  if (!id) return null;
  const trigger = isDripTrigger(row.trigger_type) ? row.trigger_type : "enrolment_delay";
  const scope = isDripScope(row.scope) ? row.scope : "static";
  return {
    id,
    title: asText(row.title),
    body: asText(row.body),
    trigger,
    delayDays: asInt(row.delay_days),
    sendOn: asDateOnly(row.send_on),
    lessonId: asOptionalText(row.lesson_id),
    taskId: asOptionalText(row.task_id),
    scope,
    cohortId: scope === "cohort" ? normalizeCohortId(asOptionalText(row.cohort_id)) : null,
    isActive: row.is_active !== false,
    createdAt: asText(row.created_at),
    updatedAt: asText(row.updated_at),
    createdBy: asOptionalText(row.created_by),
    deliveryCount,
  };
}

export function validateDripWrite(input: DripWrite): { ok: true; write: DripWrite } | { ok: false; error: string } {
  const title = asText(input.title);
  const body = asText(input.body);
  if (!title) return { ok: false, error: "Add a title for this drip message." };
  if (!body) return { ok: false, error: "Write the message students should receive." };
  if (!isDripTrigger(input.trigger)) return { ok: false, error: "Choose when this message should send." };
  if (!isDripScope(input.scope)) return { ok: false, error: "Choose current cohort only, or current and future." };

  const write: DripWrite = {
    id: asOptionalText(input.id) || undefined,
    title,
    body,
    trigger: input.trigger,
    delayDays: null,
    sendOn: null,
    lessonId: null,
    taskId: null,
    scope: input.scope,
    cohortId: null,
    isActive: input.isActive !== false,
  };

  if (input.trigger === "enrolment_delay") {
    const days = asInt(input.delayDays);
    if (days == null || days < 0) return { ok: false, error: "Enter how many days after enrolment this should send." };
    write.delayDays = days;
  } else if (input.trigger === "fixed_date") {
    const sendOn = asDateOnly(input.sendOn);
    if (!sendOn) return { ok: false, error: "Choose the date this message should send." };
    write.sendOn = sendOn;
  } else if (input.trigger === "lesson_completed") {
    const lessonId = asOptionalText(input.lessonId);
    if (!lessonId) return { ok: false, error: "Choose the lesson that should trigger this message." };
    write.lessonId = lessonId;
  } else {
    const taskId = asOptionalText(input.taskId);
    if (!taskId) return { ok: false, error: "Choose the task that should trigger this message." };
    write.taskId = taskId;
  }

  if (input.scope === "cohort") {
    write.cohortId = normalizeCohortId(asOptionalText(input.cohortId) || currentCohortId());
  }

  return { ok: true, write };
}

export function dripRowFromWrite(write: DripWrite, createdBy?: string | null): Record<string, unknown> {
  const now = new Date().toISOString();
  return {
    ...(write.id ? { id: write.id } : {}),
    title: write.title,
    body: write.body,
    trigger_type: write.trigger,
    delay_days: write.trigger === "enrolment_delay" ? write.delayDays : null,
    send_on: write.trigger === "fixed_date" ? write.sendOn : null,
    lesson_id: write.trigger === "lesson_completed" ? write.lessonId : null,
    task_id: write.trigger === "task_completed" ? write.taskId : null,
    scope: write.scope,
    cohort_id: write.scope === "cohort" ? write.cohortId : null,
    is_active: write.isActive !== false,
    updated_at: now,
    ...(write.id ? {} : { created_at: now, ...(createdBy ? { created_by: createdBy } : {}) }),
  };
}

export function dripAppliesToCohort(rule: Pick<DripMessage, "scope" | "cohortId">, studentCohort: string): boolean {
  if (rule.scope !== "cohort" || !rule.cohortId) return true;
  return normalizeCohortId(rule.cohortId) === normalizeCohortId(studentCohort);
}

export function sastDateKey(value: string | Date | null | undefined): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return isoToSastDateAndTime(value).date;
}

export function enrolmentDelayDue(enrolledAt: string | Date | null | undefined, delayDays: number, now: Date = new Date()): boolean {
  const start = sastDateKey(enrolledAt);
  if (!start || delayDays < 0) return false;
  const due = isoDate(addDays(parseISO(start), delayDays));
  const todaySast = sastDateKey(now) || isoDate(now);
  return todaySast >= due;
}

export function fixedDateDue(sendOn: string | null | undefined, now: Date = new Date()): boolean {
  const day = asDateOnly(sendOn);
  if (!day) return false;
  const todaySast = sastDateKey(now) || isoDate(now);
  return todaySast >= day;
}

export function lessonCompletedDue(completedLessonIds: string[], lessonId: string | null | undefined): boolean {
  const target = asText(lessonId);
  if (!target) return false;
  return completedLessonIds.includes(target);
}

export function taskCompletedDue(completedLessonIds: string[], taskLessonIds: string[]): boolean {
  if (!taskLessonIds.length) return false;
  return taskLessonIds.every((id) => completedLessonIds.includes(id));
}

export function dripIsDue(rule: DripMessage, student: DripStudentContext, now: Date = new Date()): boolean {
  if (!rule.isActive) return false;
  if (!dripAppliesToCohort(rule, student.cohort)) return false;
  if (rule.trigger === "enrolment_delay") {
    return enrolmentDelayDue(student.enrolledAt, rule.delayDays ?? 0, now);
  }
  if (rule.trigger === "fixed_date") {
    return fixedDateDue(rule.sendOn, now);
  }
  if (rule.trigger === "lesson_completed") {
    return lessonCompletedDue(student.completedLessonIds, rule.lessonId);
  }
  return taskCompletedDue(student.completedLessonIds, student.taskLessonIds);
}

export function dripTriggerLabel(rule: Pick<DripMessage, "trigger" | "delayDays" | "sendOn" | "lessonId" | "taskId">, labels?: {
  lessonTitle?: string;
  taskTitle?: string;
}): string {
  if (rule.trigger === "enrolment_delay") {
    const days = rule.delayDays ?? 0;
    if (days === 0) return "Day of enrolment";
    if (days % 30 === 0) {
      const months = days / 30;
      return `${months} month${months === 1 ? "" : "s"} after enrolment`;
    }
    if (days % 7 === 0) {
      const weeks = days / 7;
      return `${weeks} week${weeks === 1 ? "" : "s"} after enrolment`;
    }
    return `${days} day${days === 1 ? "" : "s"} after enrolment`;
  }
  if (rule.trigger === "fixed_date") {
    return rule.sendOn ? `On ${rule.sendOn}` : "On a specific date";
  }
  if (rule.trigger === "lesson_completed") {
    return labels?.lessonTitle ? `When they complete ${labels.lessonTitle}` : "When they complete a lesson";
  }
  return labels?.taskTitle ? `When they complete ${labels.taskTitle}` : "When they complete a task";
}

export function dripScopeLabel(rule: Pick<DripMessage, "scope" | "cohortId">): string {
  if (rule.scope === "cohort") {
    const cohortId = rule.cohortId || currentCohortId();
    return normalizeCohortId(cohortId) === currentCohortId()
      ? "Current cohort only"
      : `${displayCohortName(cohortId)} only`;
  }
  return "Current and future";
}

export async function listCoachDrips(): Promise<{ ok: boolean; data: DripMessage[]; error?: string }> {
  try {
    const response = await fetch("/api/coach/drips");
    const payload = (await response.json().catch(() => ({}))) as { data?: DripMessage[]; error?: string };
    if (!response.ok) return { ok: false, data: [], error: payload.error || "Could not load drip messages." };
    return { ok: true, data: payload.data || [] };
  } catch (error) {
    return { ok: false, data: [], error: error instanceof Error ? error.message : "Could not load drip messages." };
  }
}

export async function saveCoachDrip(write: DripWrite): Promise<{ ok: boolean; data?: DripMessage; error?: string }> {
  try {
    const response = await fetch("/api/coach/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "save", message: write }),
    });
    const payload = (await response.json().catch(() => ({}))) as { data?: DripMessage; error?: string };
    if (!response.ok) return { ok: false, error: payload.error || "Could not save that drip message." };
    return { ok: true, data: payload.data };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not save that drip message." };
  }
}

export async function deleteCoachDrip(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await fetch("/api/coach/drips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) return { ok: false, error: payload.error || "Could not delete that drip message." };
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Could not delete that drip message." };
  }
}

export function completionDripForLesson(messages: DripMessage[], lessonId: string): DripMessage | null {
  return messages.find((message) => message.trigger === "lesson_completed" && message.lessonId === lessonId) || null;
}

export function isTaskChapterOption(title: string): boolean {
  return isTaskChapter(title);
}

export function dripTableMissing(message: string): boolean {
  return /drip_messages|drip_deliveries|schema cache|does not exist/i.test(message);
}

export async function requestDripCatchup(): Promise<void> {
  try {
    await fetch("/api/student/notifications/catch-up", { method: "POST" });
  } catch {
    /* Delivery can wait until the next inbox load. */
  }
}
