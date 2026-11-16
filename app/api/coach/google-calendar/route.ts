import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  disconnectGoogleCalendar,
  getGoogleCalendarSettings,
  listGoogleCalendarImports,
  syncGoogleCalendarEvents,
} from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  return NextResponse.json({
    ok: true,
    ...(await getGoogleCalendarSettings()),
    imports: await listGoogleCalendarImports(),
  });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action || "sync");

  if (action === "disconnect") {
    const saved = await disconnectGoogleCalendar();
    if (!saved.ok) return NextResponse.json({ error: saved.error || "Could not disconnect Google Calendar." }, { status: 400 });
    return NextResponse.json({ ok: true, ...(await getGoogleCalendarSettings()), imports: await listGoogleCalendarImports() });
  }

  const result = await syncGoogleCalendarEvents();
  return NextResponse.json(
    { ...(await getGoogleCalendarSettings()), imports: await listGoogleCalendarImports(), ...result },
    { status: result.ok ? 200 : 400 }
  );
}
