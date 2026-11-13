import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { claimDueDripMessagesForStudent } from "@/lib/drip-messages-admin";
import { claimMissedCohortAnnouncements } from "@/lib/notification-catchup-admin";
import { claimDueScheduledSends } from "@/lib/scheduled-sends-admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getRequestUser();
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const [missed, drips, scheduled] = await Promise.all([
    claimMissedCohortAnnouncements({ studentId: user.id, email: user.email }),
    claimDueDripMessagesForStudent({ studentId: user.id, email: user.email }),
    claimDueScheduledSends({ studentId: user.id }),
  ]);
  if (!missed.ok && !drips.ok && !scheduled.ok) {
    return NextResponse.json({ error: missed.error || drips.error || scheduled.error || "Could not load missed notifications." }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    inserted: (missed.inserted || 0) + (drips.inserted || 0) + (scheduled.inserted || 0),
  });
}
