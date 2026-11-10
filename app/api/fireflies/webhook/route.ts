import { NextResponse } from "next/server";
import {
  importFirefliesMeeting,
  parseFirefliesWebhook,
  shouldImportFirefliesEvent,
  verifyFirefliesSignature,
} from "@/lib/fireflies";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function webhookSecret(): Promise<string> {
  const env = String(process.env.FIREFLIES_WEBHOOK_SECRET || "").trim();
  if (env) return env;
  const client = getServiceSupabase();
  if (!client) return "";
  const { data } = await client.from("fireflies_settings").select("webhook_secret").eq("id", 1).maybeSingle();
  return String(data?.webhook_secret || "").trim();
}

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = await webhookSecret();
  if (secret) {
    const signature = request.headers.get("x-hub-signature");
    if (!verifyFirefliesSignature(raw, signature, secret)) {
      return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
    }
  }

  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const event = parseFirefliesWebhook(parsed);
  if (!event) return NextResponse.json({ ok: true, ignored: true });
  if (!shouldImportFirefliesEvent(event.event)) return NextResponse.json({ ok: true, ignored: true });

  try {
    const result = await importFirefliesMeeting(event.meetingId, event.event);
    if (!result.ok && result.error?.includes("API key")) {
      return NextResponse.json({ error: result.error }, { status: 503 });
    }
    return NextResponse.json({ ok: true, status: result.status, error: result.error || undefined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not import Fireflies meeting.";
    console.error("fireflies webhook", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
