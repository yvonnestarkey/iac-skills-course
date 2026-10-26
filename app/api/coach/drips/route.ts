import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  claimDueDripMessagesForAllStudents,
  deleteDripMessage,
  listDripMessages,
  saveDripMessage,
  setDripMessageActive,
} from "@/lib/drip-messages-admin";
import { isDripTrigger, type DripWrite } from "@/lib/drip-messages";

export const dynamic = "force-dynamic";

function asWrite(value: unknown): DripWrite | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!isDripTrigger(body.trigger) && !isDripTrigger(body.trigger_type)) return null;
  return {
    id: typeof body.id === "string" ? body.id : undefined,
    title: String(body.title || ""),
    body: String(body.body || ""),
    trigger: isDripTrigger(body.trigger) ? body.trigger : (body.trigger_type as DripWrite["trigger"]),
    delayDays: body.delayDays == null ? null : Number(body.delayDays),
    sendOn: body.sendOn == null ? null : String(body.sendOn),
    lessonId: body.lessonId == null ? null : String(body.lessonId),
    taskId: body.taskId == null ? null : String(body.taskId),
    scope: body.scope === "cohort" ? "cohort" : "static",
    cohortId: body.cohortId == null ? null : String(body.cohortId),
    isActive: body.isActive !== false,
  };
}

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const listed = await listDripMessages();
  if (!listed.ok) return NextResponse.json({ error: listed.error || "Could not load drip messages." }, { status: 400 });
  return NextResponse.json({ ok: true, data: listed.data });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action || "");

  if (action === "save") {
    const write = asWrite(body?.message);
    if (!write) return NextResponse.json({ error: "Drip message details required." }, { status: 400 });
    const saved = await saveDripMessage(write, user?.id);
    if (!saved.ok) return NextResponse.json({ error: saved.error || "Could not save that drip message." }, { status: 400 });
    return NextResponse.json({ ok: true, data: saved.data });
  }

  if (action === "delete") {
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Choose a drip message to delete." }, { status: 400 });
    const removed = await deleteDripMessage(id);
    if (!removed.ok) return NextResponse.json({ error: removed.error || "Could not delete that drip message." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "toggle") {
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Choose a drip message to update." }, { status: 400 });
    const updated = await setDripMessageActive(id, body?.isActive !== false);
    if (!updated.ok) return NextResponse.json({ error: updated.error || "Could not update that drip message." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "deliver") {
    const delivered = await claimDueDripMessagesForAllStudents();
    if (!delivered.ok) {
      return NextResponse.json({ error: delivered.error || "Could not deliver due drip messages." }, { status: 400 });
    }
    return NextResponse.json({ ok: true, inserted: delivered.inserted });
  }

  return NextResponse.json({ error: "Drip action required." }, { status: 400 });
}
