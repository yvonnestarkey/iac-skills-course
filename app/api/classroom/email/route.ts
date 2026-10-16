import { NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import {
  sendClassroomEmails,
  type ClassroomEmailBatch,
  type ClassroomEmailKind,
} from "@/lib/student-classroom-email";

export const dynamic = "force-dynamic";

const KINDS = new Set<ClassroomEmailKind>(["announcement", "message", "assignment_feedback", "script_evaluation"]);

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!isStaffUser(user)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as ClassroomEmailBatch | null;
  const kind = body?.kind;
  const title = String(body?.title || "").trim();
  const message = String(body?.message || "").trim();
  const recipients = Array.isArray(body?.recipients) ? body.recipients : [];
  if (!kind || !KINDS.has(kind)) return NextResponse.json({ error: "Unknown classroom email kind." }, { status: 400 });
  if (!title && !message) return NextResponse.json({ error: "Write a title or message first." }, { status: 400 });
  if (!recipients.length) return NextResponse.json({ ok: true, sent: 0, failed: 0 });

  const result = await sendClassroomEmails({
    kind,
    title,
    message,
    recipients: recipients.map((recipient) => ({
      email: String(recipient?.email || "").trim(),
      name: recipient?.name ? String(recipient.name) : null,
      userId: recipient?.userId ? String(recipient.userId) : null,
      recordId: recipient?.recordId ? String(recipient.recordId) : null,
      attemptId: recipient?.attemptId ? String(recipient.attemptId) : null,
    })),
  });
  return NextResponse.json({ ok: true, ...result });
}
