import { NextResponse } from "next/server";
import { joinPersonName, validatePersonName } from "@/lib/account-profile";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { updateStudentDisplayName } from "@/lib/student-profile-admin";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    student_id?: string;
    first_name?: string;
    last_name?: string;
  } | null;
  const studentId = String(body?.student_id || "").trim();
  if (!studentId) return NextResponse.json({ error: "Student required." }, { status: 400 });

  const invalid = validatePersonName(body?.first_name, body?.last_name);
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

  const fullName = joinPersonName(body?.first_name, body?.last_name);
  const result = await updateStudentDisplayName(studentId, fullName);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: 400 });

  return NextResponse.json({ ok: true, full_name: result.full_name, name: result.full_name });
}
