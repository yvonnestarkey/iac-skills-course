import { NextResponse } from "next/server";
import { sendPasswordSetupForEmail } from "@/lib/account-recovery-admin";
import { publicPasswordSetupCopy } from "@/lib/account-recovery";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { email?: string } | null;
  const result = await sendPasswordSetupForEmail(body?.email || "");
  return NextResponse.json({
    ok: true,
    message: publicPasswordSetupCopy(),
    created_user: false,
    entitlement_changed: false,
    emailed: result.reason === "send_failed" ? false : result.emailed || result.reason === "recently_sent",
  });
}
