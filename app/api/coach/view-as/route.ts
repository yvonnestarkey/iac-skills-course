import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { isUserId } from "@/lib/notifications";
import {
  VIEW_AS_STUDENT_COOKIE,
  canStartViewAsStudent,
  parseViewAsStudentId,
} from "@/lib/view-as-student";
import { buildViewAsSession, readViewAsStudentId, viewAsCookieOptions } from "@/lib/view-as-student-server";

export const dynamic = "force-dynamic";

function clearCookie(response: NextResponse) {
  response.cookies.set(VIEW_AS_STUDENT_COOKIE, "", viewAsCookieOptions(0));
  return response;
}

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ student: null });
  const studentId = await readViewAsStudentId();
  if (!studentId) return NextResponse.json({ student: null, entitlement: null, entitlement_source: null, preview_lesson_ids: [] });
  const payload = await buildViewAsSession(studentId);
  const response = NextResponse.json(payload);
  if (!payload.student) clearCookie(response);
  return response;
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const body = (await request.json().catch(() => ({}))) as { studentId?: string };
  const studentId = parseViewAsStudentId(body.studentId);
  if (!studentId || !isUserId(studentId) || !canStartViewAsStudent(user, studentId)) {
    return NextResponse.json({ error: "Choose a student to view as." }, { status: 400 });
  }
  const payload = await buildViewAsSession(studentId);
  if (!payload.student) return NextResponse.json({ error: "No such student." }, { status: 404 });
  const response = NextResponse.json(payload);
  response.cookies.set(VIEW_AS_STUDENT_COOKIE, studentId, viewAsCookieOptions());
  return response;
}

export async function DELETE() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const studentId = await readViewAsStudentId();
  const response = NextResponse.json({ ok: true, studentId });
  return clearCookie(response);
}
