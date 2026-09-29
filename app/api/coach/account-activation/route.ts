import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { coachActivationPublicRow } from "@/lib/account-activation";
import { listAccountActivationSnapshots } from "@/lib/account-recovery-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const snapshots = await listAccountActivationSnapshots();
  return NextResponse.json({
    users: snapshots.map((snapshot) => coachActivationPublicRow(snapshot)),
  });
}
