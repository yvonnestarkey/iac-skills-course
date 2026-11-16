import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { syncGoogleCalendarEvents } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST() {
  const user = await getRequestUser();
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const result = await syncGoogleCalendarEvents();
  return NextResponse.json({ ok: result.ok, error: result.error });
}
