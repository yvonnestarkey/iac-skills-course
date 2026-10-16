import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { claimMissedCohortAnnouncements } from "@/lib/notification-catchup-admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getRequestUser();
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const result = await claimMissedCohortAnnouncements({ studentId: user.id, email: user.email });
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Could not load missed notifications." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, inserted: result.inserted });
}
