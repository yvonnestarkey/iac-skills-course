import { isUserId } from "./notifications";
import { isCoachAccount } from "./roles";
import type { EntitlementSource } from "./account-access";
import type { EntitlementStatus } from "./commerce";
import type { StudentUser } from "./student-lesson";

export const VIEW_AS_STUDENT_COOKIE = "view_as_student";
export const VIEW_AS_STUDENT_MAX_AGE = 4 * 60 * 60;
export const VIEW_AS_STUDENT_HOME = "/student/dashboard";

export type ViewAsEntitlement = EntitlementStatus | "staff" | "none" | null;

export type ViewAsSessionPayload = {
  student: StudentUser | null;
  entitlement: ViewAsEntitlement;
  entitlement_source: EntitlementSource | null;
  preview_lesson_ids: string[];
};

export function parseViewAsStudentId(value: string | null | undefined): string | null {
  const id = String(value || "").trim();
  return isUserId(id) ? id : null;
}

export function viewAsStudentUser(input: {
  id: string;
  email?: string | null;
  full_name?: string | null;
  name?: string | null;
}): StudentUser {
  const name = String(input.full_name || input.name || "").trim() || null;
  const email = String(input.email || "").trim() || null;
  return {
    id: input.id,
    email,
    role: null,
    full_name: name,
  };
}

export function canStartViewAsStudent(
  actor: { id?: string; email?: string | null; role?: string | null; app_metadata?: Record<string, unknown> | null } | null | undefined,
  studentId: string
): boolean {
  if (!isCoachAccount(actor)) return false;
  const id = parseViewAsStudentId(studentId);
  if (!id) return false;
  if (actor?.id && actor.id === id) return false;
  return true;
}

export function viewAsDisplayName(student: Pick<StudentUser, "full_name" | "email"> | null | undefined): string {
  const name = String(student?.full_name || "").trim();
  if (name) return name;
  const email = String(student?.email || "").trim();
  if (email) return email.split("@")[0] || email;
  return "this student";
}

export async function fetchViewAsSession(): Promise<ViewAsSessionPayload> {
  const empty: ViewAsSessionPayload = {
    student: null,
    entitlement: null,
    entitlement_source: null,
    preview_lesson_ids: [],
  };
  try {
    const response = await fetch("/api/coach/view-as", { cache: "no-store" });
    if (!response.ok) return empty;
    const payload = (await response.json().catch(() => ({}))) as Partial<ViewAsSessionPayload>;
    if (!payload.student?.id) return empty;
    return {
      student: viewAsStudentUser(payload.student),
      entitlement:
        payload.entitlement === "full" ||
        payload.entitlement === "free_preview" ||
        payload.entitlement === "none" ||
        payload.entitlement === "staff"
          ? payload.entitlement
          : "free_preview",
      entitlement_source:
        payload.entitlement_source === "admin" ||
        payload.entitlement_source === "stripe" ||
        payload.entitlement_source === "signup"
          ? payload.entitlement_source
          : "signup",
      preview_lesson_ids: Array.isArray(payload.preview_lesson_ids)
        ? payload.preview_lesson_ids.map(String)
        : [],
    };
  } catch {
    return empty;
  }
}

export async function startViewAsStudent(
  studentId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/coach/view-as", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    const payload = (await response.json().catch(() => ({}))) as { error?: string; student?: StudentUser | null };
    if (!response.ok || !payload.student?.id) {
      return { ok: false, error: payload.error || "Could not open that student's classroom." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not open that student's classroom." };
  }
}

export async function exitViewAsStudent(): Promise<void> {
  await fetch("/api/coach/view-as", { method: "DELETE" }).catch(() => undefined);
}
