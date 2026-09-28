import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { sendPasswordSetupForEmail } from "@/lib/account-recovery-admin";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { user_id?: string; email?: string } | null;
  let email = body?.email?.trim().toLowerCase() || "";
  if (!email && body?.user_id) {
    const client = getServiceSupabase();
    if (client) {
      const { data } = await client.from("profiles").select("email").eq("id", body.user_id).maybeSingle();
      email = String(data?.email || "").trim().toLowerCase();
    }
  }
  if (!email) return NextResponse.json({ error: "Student email required." }, { status: 400 });

  const result = await sendPasswordSetupForEmail(email);
  if (result.reason === "not_found") {
    return NextResponse.json({ error: "No Auth account exists for that student email.", ...result }, { status: 404 });
  }
  if (result.reason === "send_failed") {
    return NextResponse.json({ error: result.message, ...result }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    message:
      result.reason === "recently_sent"
        ? "A password setup link was already sent a moment ago. Wait before sending another."
        : "Password setup link sent. This does not change course access.",
    created_user: false,
    entitlement_changed: false,
    emailed: result.emailed,
    reason: result.reason,
  });
}
