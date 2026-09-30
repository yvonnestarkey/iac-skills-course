import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { setTemporaryPasswordForUser } from "@/lib/set-temporary-password-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as {
    user_id?: string;
    password?: string;
    confirm?: boolean;
  } | null;

  if (!body?.confirm) {
    return NextResponse.json({ error: "Confirm Set temporary password before changing it." }, { status: 400 });
  }

  const userId = String(body.user_id || "").trim();
  if (!userId) return NextResponse.json({ error: "Student required." }, { status: 400 });

  const result = await setTemporaryPasswordForUser(userId, String(body.password || ""));
  if (result.ok === false) {
    const status = result.error === "That user was not found." ? 404 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }

  return NextResponse.json({
    ok: true,
    user_id: result.user_id,
    email: result.email || null,
    message: "Temporary password set. Copy it now — it is not stored on the server.",
  });
}
