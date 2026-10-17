import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { updateStudentRegistration } from "@/lib/student-registration-admin";
import type { RegistrationAction } from "@/lib/student-registration";

export const dynamic = "force-dynamic";

const ACTIONS = new Set<RegistrationAction>(["deregister", "set_expiry", "restore"]);

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    user_id?: string;
    action?: RegistrationAction;
    expires_on?: string;
  } | null;
  const action = body?.action;
  if (!action || !ACTIONS.has(action)) return NextResponse.json({ error: "Unknown registration action." }, { status: 400 });

  const result = await updateStudentRegistration({
    userId: String(body?.user_id || ""),
    action,
    expiresOn: body?.expires_on,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
