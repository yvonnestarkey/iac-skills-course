import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  generateFirefliesWebhookSecret,
  getFirefliesSettings,
  listFirefliesImports,
  resolveFirefliesApiKey,
  saveFirefliesSettings,
  syncPastFirefliesMeetings,
  testFirefliesApiKey,
} from "@/lib/fireflies";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const settings = await getFirefliesSettings();
  if (!settings.webhookSecretSet) {
    await saveFirefliesSettings({ webhookSecret: generateFirefliesWebhookSecret() });
  }
  const latest = await getFirefliesSettings();
  return NextResponse.json({ ok: true, ...latest, imports: await listFirefliesImports() });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action || "save");
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey : "";
  const webhookSecret = typeof body?.webhookSecret === "string" ? body.webhookSecret : "";

  if (action === "test") {
    const useKey = apiKey.trim() || (await resolveFirefliesApiKey());
    if (!useKey) return NextResponse.json({ ok: false, error: "Paste a Fireflies API key first." }, { status: 400 });
    const result = await testFirefliesApiKey(useKey);
    return NextResponse.json(result, { status: result.ok ? 200 : 400 });
  }

  if (action === "sync") {
    try {
      const result = await syncPastFirefliesMeetings();
      const latest = await getFirefliesSettings();
      return NextResponse.json({ ...latest, imports: await listFirefliesImports(), ...result }, { status: result.ok ? 200 : 400 });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not import past Fireflies calls.";
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  const saved = await saveFirefliesSettings({
    apiKey: apiKey.trim() || null,
    webhookSecret: webhookSecret.trim() || null,
  });
  if (!saved.ok) return NextResponse.json({ error: saved.error || "Could not save Fireflies settings." }, { status: 400 });
  const latest = await getFirefliesSettings();
  return NextResponse.json({ ok: true, ...latest, imports: await listFirefliesImports() });
}
