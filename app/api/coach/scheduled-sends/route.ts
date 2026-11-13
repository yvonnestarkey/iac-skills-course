import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  cancelScheduledSendAdmin,
  claimDueScheduledSends,
  createScheduledSendAdmin,
  listScheduledSendsAdmin,
} from "@/lib/scheduled-sends-admin";
import {
  isScheduledChannel,
  isScheduledTrigger,
  scheduledRecipientsFromUnknown,
  type ScheduledSendWrite,
} from "@/lib/scheduled-sends";

export const dynamic = "force-dynamic";

function asWrite(value: unknown): ScheduledSendWrite | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  if (!isScheduledChannel(body.channel) || !isScheduledTrigger(body.trigger)) return null;
  return {
    channel: body.channel,
    messageKind: body.messageKind === "feedback" ? "feedback" : "reply",
    title: String(body.title || ""),
    body: String(body.body || ""),
    pdfUrl: body.pdfUrl == null ? "" : String(body.pdfUrl),
    pdfName: body.pdfName == null ? "" : String(body.pdfName),
    audience: (body.audience as ScheduledSendWrite["audience"]) || "student",
    audienceLabel: String(body.audienceLabel || ""),
    recipients: scheduledRecipientsFromUnknown(body.recipients),
    trigger: body.trigger,
    sendAt: body.sendAt == null ? null : String(body.sendAt),
    lessonId: body.lessonId == null ? null : String(body.lessonId),
    taskId: body.taskId == null ? null : String(body.taskId),
  };
}

export async function GET() {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const listed = await listScheduledSendsAdmin();
  if (!listed.ok) return NextResponse.json({ error: listed.error || "Could not load scheduled sends." }, { status: 400 });
  return NextResponse.json({ ok: true, data: listed.data });
}

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = String(body?.action || "");

  if (action === "create") {
    const write = asWrite(body?.send);
    if (!write) return NextResponse.json({ error: "Scheduled send details required." }, { status: 400 });
    const saved = await createScheduledSendAdmin(write, user?.id);
    if (!saved.ok) return NextResponse.json({ error: saved.error || "Could not schedule that send." }, { status: 400 });
    return NextResponse.json({ ok: true, data: saved.data });
  }

  if (action === "cancel") {
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Choose a scheduled send to cancel." }, { status: 400 });
    const cancelled = await cancelScheduledSendAdmin(id);
    if (!cancelled.ok) return NextResponse.json({ error: cancelled.error || "Could not cancel that send." }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "deliver") {
    const delivered = await claimDueScheduledSends();
    if (!delivered.ok) return NextResponse.json({ error: delivered.error || "Could not send due messages." }, { status: 400 });
    return NextResponse.json({ ok: true, inserted: delivered.inserted });
  }

  return NextResponse.json({ error: "Scheduled send action required." }, { status: 400 });
}
