import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth-server";
import { sendResendEmail } from "@/lib/resend";
import { REGISTRATION_CONTACT_EMAIL } from "@/lib/sales-copy";
import {
  assignmentSubmittedNotifyKey,
  assignmentSubmittedNotifySubject,
  shouldNotifyCoachOfLessonSubmission,
} from "@/lib/student-submissions";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const user = await getRequestUser();
  if (!user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!shouldNotifyCoachOfLessonSubmission(user.email)) {
    return NextResponse.json({ ok: true, sent: false });
  }

  const body = (await request.json().catch(() => ({}))) as { lessonId?: string };
  const lessonId = String(body.lessonId || "").trim();
  if (!lessonId) return NextResponse.json({ error: "Missing lesson." }, { status: 400 });

  const client = getServiceSupabase();
  let lessonTitle = lessonId;
  let studentName = String(user.full_name || "").trim();
  if (client) {
    const [{ data: lesson }, { data: profile }] = await Promise.all([
      client.from("lessons").select("title").eq("id", lessonId).maybeSingle(),
      studentName ? Promise.resolve({ data: null }) : client.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    ]);
    lessonTitle = String(lesson?.title || lessonTitle).trim() || lessonId;
    studentName = studentName || String(profile?.full_name || "").trim();
  }
  studentName = studentName || user.email || "Student";

  const subject = assignmentSubmittedNotifySubject(studentName, lessonTitle);
  const lines = [
    `Student name: ${studentName}`,
    `Student email: ${user.email || ""}`,
    `Assignment: ${lessonTitle}`,
    "Open the Submissions tab or their student profile to review it.",
  ];
  try {
    await sendResendEmail({
      to: REGISTRATION_CONTACT_EMAIL,
      subject,
      text: lines.join("\n"),
      html: `<p>${lines.map((line) => line.replace(/&/g, "&amp;").replace(/</g, "&lt;")).join("<br />")}</p>`,
      idempotencyKey: assignmentSubmittedNotifyKey(user.id, lessonId),
    });
    return NextResponse.json({ ok: true, sent: true });
  } catch (error) {
    console.error("assignment-submitted-notify", error);
    return NextResponse.json({ ok: true, sent: false });
  }
}
