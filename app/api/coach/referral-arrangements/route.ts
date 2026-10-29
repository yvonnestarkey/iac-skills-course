import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { loadReferralArrangementViews } from "@/lib/referral-arrangement-notify";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 401 });
  const arrangements = await loadReferralArrangementViews();
  return NextResponse.json({ arrangements });
}
