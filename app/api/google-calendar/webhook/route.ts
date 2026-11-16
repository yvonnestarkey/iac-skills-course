import { NextResponse } from "next/server";
import { googleWebhookIsAuthorized, syncGoogleCalendarEvents } from "@/lib/google-calendar";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function POST(request: Request) {
  const state = String(request.headers.get("x-goog-resource-state") || "");
  const channelId = String(request.headers.get("x-goog-channel-id") || "");
  const resourceId = String(request.headers.get("x-goog-resource-id") || "");
  if (state === "sync") return NextResponse.json({ ok: true });
  if (!(await googleWebhookIsAuthorized(channelId, resourceId))) {
    return NextResponse.json({ error: "Unknown calendar channel." }, { status: 404 });
  }
  try {
    const result = await syncGoogleCalendarEvents();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sync Google Calendar.";
    console.error("google calendar webhook", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
