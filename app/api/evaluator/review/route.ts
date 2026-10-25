import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  COACH_REPORT_SQL,
  coachReportStoragePath,
  isCoachReportPdf,
  isMissingCoachReportColumn,
} from "@/lib/evaluator/coach-report";
import { parseEvaluatorMode } from "@/lib/evaluator/job-rules";
import { createJobsForAttempt, kickJob, retryJob, setEvaluatorMode } from "@/lib/evaluator/jobs";
import { isEvaluatorReadySitting } from "@/lib/evaluator/ready-sittings";
import { sendResendEmail } from "@/lib/resend";
import { isCoachAccount } from "@/lib/roles";
import { studentUserFromAuth } from "@/lib/student-lesson";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

/** A course notification (the bell). Older notifications tables lack some columns, so retry with fewer. */
async function notifyStudent(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  n: { userId: string; email: string | null; title: string; message: string }
) {
  const base = { user_id: n.userId, student_id: n.userId, student_email: n.email, from_role: "coach", kind: "announcement", body: n.message };
  const attempts = [
    { ...base, type: "announcement", title: n.title, message: n.message, read: false },
    { ...base, title: n.title, message: n.message, read: false },
    base,
  ];
  for (const payload of attempts) {
    const { error } = await service.from("notifications").insert(payload);
    if (!error) return;
  }
}

/** Staff actions from Coach tools > Script Evaluator reports: release / hide a report, retry a paper, the switch. */
export async function POST(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = getServiceSupabase();
  if (!url || !anonKey || !service) return NextResponse.json({ error: "Not configured." }, { status: 500 });
  const supabase = createServerClient(url, anonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll() {} } });
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isCoachAccount(studentUserFromAuth(user))) return NextResponse.json({ error: "Staff only." }, { status: 403 });

  const form = await request.formData();
  const action = String(form.get("action") || "");
  const backTo = (notice?: string) => {
    const dest = new URL("/coach/evaluator", request.url);
    if (notice) dest.searchParams.set("notice", notice);
    return NextResponse.redirect(dest, 303);
  };
  const back = backTo();

  if (action === "mode") {
    await setEvaluatorMode(parseEvaluatorMode(form.get("mode")));
    return back;
  }
  if (action === "start") {
    const attemptId = String(form.get("attempt_id") || "");
    const { data: row } = await service.from("exam_attempts").select("id, sitting_id").eq("id", attemptId).maybeSingle();
    const attempt = row as { id: string; sitting_id: string } | null;
    if (attempt && isEvaluatorReadySitting(attempt.sitting_id)) {
      const jobs = await createJobsForAttempt(attempt, request.nextUrl.origin);
      await Promise.all(jobs.filter((job) => job.status !== "done").map((job) => kickJob(job, request.nextUrl.origin)));
    }
    return back;
  }
  if (action === "retry") {
    const job = await retryJob(String(form.get("job_id") || ""));
    if (job) await kickJob(job, request.nextUrl.origin);
    return back;
  }
  if (action === "upload_report") {
    const attemptId = String(form.get("attempt_id") || "");
    const file = form.get("file");
    if (!attemptId) return backTo("Choose a student attempt first.");
    if (!(file instanceof File) || !file.size) return backTo("Choose a PDF to upload.");
    if (file.size > 50 * 1024 * 1024) return backTo("That PDF is larger than 50 MB.");
    if (!isCoachReportPdf(file)) return backTo("Please upload a PDF file.");
    const { data: row } = await service.from("exam_attempts").select("id, user_id").eq("id", attemptId).maybeSingle();
    const attempt = row as { id: string; user_id: string } | null;
    if (!attempt) return backTo("That exam attempt was not found.");
    const path = coachReportStoragePath({ userId: attempt.user_id, attemptId, fileName: file.name });
    const uploaded = await service.storage.from("course-pdfs").upload(path, Buffer.from(await file.arrayBuffer()), {
      upsert: false,
      contentType: "application/pdf",
    });
    if (uploaded.error) return backTo(uploaded.error.message || "Could not upload that PDF.");
    const { data: publicFile } = service.storage.from("course-pdfs").getPublicUrl(path);
    if (!publicFile?.publicUrl) return backTo("Could not get a URL for that file.");
    const now = new Date().toISOString();
    const { error } = await service
      .from("exam_attempts")
      .update({
        coach_report_path: path,
        coach_report_url: publicFile.publicUrl,
        coach_report_name: file.name,
        coach_report_uploaded_at: now,
        coach_report_uploaded_by: user.id,
        updated_at: now,
      })
      .eq("id", attemptId);
    if (error) return backTo(isMissingCoachReportColumn(error.message) ? COACH_REPORT_SQL : error.message);
    return back;
  }
  if (action === "release" || action === "unrelease") {
    const attemptId = String(form.get("attempt_id") || "");
    const release = action === "release";
    const releasedAt = new Date().toISOString();
    const { data, error } = await service
      .from("exam_attempts")
      .update({ evaluator_report_released_at: release ? releasedAt : null, evaluator_report_released_by: release ? user.id : null })
      .eq("id", attemptId)
      .select("user_id, sitting_label")
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const row = data as { user_id?: string; sitting_label?: string } | null;
    if (release && row?.user_id) {
      // Tell the student: a notification in the course (the bell) and an email, both pointing to the Script Evaluator.
      const { data: profile } = await service.from("profiles").select("email, full_name").eq("id", row.user_id).maybeSingle();
      const p = profile as { email?: string; full_name?: string | null } | null;
      const link = `${request.nextUrl.origin}/student/evaluator/attempt/${attemptId}/submitted`;
      const title = "Your Script Evaluator report is ready";
      const message = `Your report${row.sitting_label ? ` for ${row.sitting_label}` : ""} is ready. Open the Script Evaluator and click your exam attempt to view or download it.`;
      await notifyStudent(service, { userId: row.user_id, email: p?.email ?? null, title, message });
      if (p?.email) {
        await sendResendEmail({
          to: p.email,
          subject: title,
          text: `Hi ${p.full_name?.split(" ")[0] || "there"},\n\n${message}\n\n${link}\n\nYvonne`,
          idempotencyKey: `evaluator-released-${attemptId}-${releasedAt.slice(0, 16)}`,
        }).catch(() => undefined);
      }
    }
    return back;
  }
  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
