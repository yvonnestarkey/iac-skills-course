import { cookies } from "next/headers";
import { getEntitlementRecord, listPreviewLessonIds } from "./commerce";
import { isCoachAccount } from "./roles";
import { getServiceSupabase } from "./supabase-admin";
import {
  VIEW_AS_STUDENT_COOKIE,
  VIEW_AS_STUDENT_MAX_AGE,
  canStartViewAsStudent,
  parseViewAsStudentId,
  viewAsStudentUser,
  type ViewAsSessionPayload,
} from "./view-as-student";
import type { StudentUser } from "./student-lesson";

export async function readViewAsStudentId(): Promise<string | null> {
  const store = await cookies();
  return parseViewAsStudentId(store.get(VIEW_AS_STUDENT_COOKIE)?.value);
}

export function viewAsCookieOptions(maxAge = VIEW_AS_STUDENT_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function loadViewAsStudent(studentId: string): Promise<StudentUser | null> {
  const id = parseViewAsStudentId(studentId);
  if (!id) return null;
  const client = getServiceSupabase();
  if (!client) return null;
  const { data } = await client.from("profiles").select("id, email, full_name, role").eq("id", id).maybeSingle();
  if (!data) return null;
  const row = data as { id: string; email?: string | null; full_name?: string | null; role?: string | null };
  if (isCoachAccount({ id: row.id, email: row.email, role: row.role || null })) return null;
  return viewAsStudentUser(row);
}

export async function buildViewAsSession(studentId: string): Promise<ViewAsSessionPayload> {
  const student = await loadViewAsStudent(studentId);
  if (!student) {
    return { student: null, entitlement: null, entitlement_source: null, preview_lesson_ids: [] };
  }
  const [entitlement, previewIds] = await Promise.all([getEntitlementRecord(student.id), listPreviewLessonIds()]);
  return {
    student,
    entitlement: entitlement.accessActive ? entitlement.status : "none",
    entitlement_source: entitlement.source,
    preview_lesson_ids: previewIds,
  };
}

/** The student whose classroom this request should render, if a coach is mimicking one. */
export async function getClassroomSubjectUser(actor: StudentUser | null): Promise<StudentUser | null> {
  if (!actor) return null;
  if (!isCoachAccount(actor)) return actor;
  const studentId = await readViewAsStudentId();
  if (!studentId || !canStartViewAsStudent(actor, studentId)) return actor;
  return (await loadViewAsStudent(studentId)) || actor;
}
