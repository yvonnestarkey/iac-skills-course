import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import {
  buildStudentInboxNotifyEmail,
  shouldNotifyCoachOfStudentMessage,
  STUDENT_INBOX_NOTIFY_TO,
  studentInboxNotifyKey,
} from "@/lib/inbox-notify";
import { sendResendEmail } from "@/lib/resend";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!shouldNotifyCoachOfStudentMessage(user.email)) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const body = (await request.json().catch(() => ({}))) as { messageId?: string; context?: string };
  const messageId = String(body.messageId || "").trim();
  if (!messageId) return NextResponse.json({ error: "Missing message." }, { status: 400 });

  const client = getServiceSupabase();
  let studentName = String(user.full_name || "").trim();
  let studentEmail = String(user.email || "").trim();
  let messageBody = "";
  let context = String(body.context || "").trim();

  if (client) {
    const [{ data: message }, { data: profile }] = await Promise.all([
      client
        .from("inbox_messages")
        .select("id, student_id, student_email, from_role, body, context, pdf_url, pdf_name")
        .eq("id", messageId)
        .maybeSingle(),
      studentName
        ? Promise.resolve({ data: null })
        : client.from("profiles").select("full_name, email").eq("id", user.id).maybeSingle(),
    ]);
    if (!message || String(message.from_role || "") !== "student") {
      return NextResponse.json({ error: "This message could not be found." }, { status: 404 });
    }
    if (String(message.student_id || "") && String(message.student_id) !== user.id) {
      return NextResponse.json({ error: "This message could not be found." }, { status: 404 });
    }
    const pdfUrl = String((message as { pdf_url?: string }).pdf_url || "").trim();
    const pdfName = String((message as { pdf_name?: string }).pdf_name || "").trim();
    messageBody = [String(message.body || "").trim(), pdfUrl ? `${pdfName || "PDF"}\n${pdfUrl}` : ""]
      .filter(Boolean)
      .join("\n\n");
    context = context || String(message.context || "").trim();
    studentEmail = studentEmail || String(message.student_email || "").trim() || String(profile?.email || "").trim();
    studentName = studentName || String(profile?.full_name || "").trim();
  }

  studentName = studentName || studentEmail || "Student";
  if (!messageBody) return NextResponse.json({ ok: true, sent: false });

  const email = buildStudentInboxNotifyEmail({
    studentName,
    studentEmail,
    body: messageBody,
    context,
  });
  try {
    await sendResendEmail({
      to: STUDENT_INBOX_NOTIFY_TO,
      subject: email.subject,
      text: email.text,
      html: email.html,
      idempotencyKey: studentInboxNotifyKey(messageId),
    });
    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    console.error("student-inbox-notify", error);
    return NextResponse.json({ ok: true, sent: false });
  }
}
