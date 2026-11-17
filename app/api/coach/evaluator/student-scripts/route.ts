import { after, NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { prepareExamAttemptEvidence } from "@/lib/exam-attempt-evidence";
import {
  attemptHasAllRequiredFiles,
  attemptPaperName,
  createExamAttempt,
  deriveAttemptStatus,
  examAttemptFileStoragePath,
  examAttemptFromRow,
  examAttemptPageStoragePath,
  isAttemptSubmitted,
  isExamAttemptFileKind,
  isExamAttemptPdfFile,
  requestScriptEvaluation,
  type ExamAttempt,
  type ExamAttemptFileKind,
  type ExamAttemptPageImage,
} from "@/lib/exam-attempts";
import { newEvaluatorApplies } from "@/lib/evaluator/job-rules";
import { createJobsForAttempt, getEvaluatorMode, jobsForAttempt, kickJob } from "@/lib/evaluator/jobs";
import { isEvaluatorReadySitting } from "@/lib/evaluator/ready-sittings";
import { isUserId } from "@/lib/notifications";
import { STUDENT_ATTEMPT_SOURCE } from "@/lib/staff-access";
import { getServiceSupabase } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type AttemptRow = Record<string, unknown>;

async function loadAttempt(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  attemptId: string,
  studentId: string
): Promise<ExamAttempt | null> {
  const { data } = await service.from("exam_attempts").select("*").eq("id", attemptId).eq("user_id", studentId).maybeSingle();
  return data ? examAttemptFromRow(data as AttemptRow) : null;
}

export async function POST(request: Request) {
  const actor = await getRequestUser();
  if (!isStaffUser(actor)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const studentId = String(form.get("studentId") || "");
    const attemptId = String(form.get("attemptId") || "");
    const kindValue = String(form.get("kind") || "");
    const file = form.get("file");
    if (!isUserId(studentId) || !isUserId(attemptId) || !isExamAttemptFileKind(kindValue)) {
      return NextResponse.json({ error: "Choose the student, attempt, and which PDF this is." }, { status: 400 });
    }
    if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Choose a PDF to upload." }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "That PDF is larger than 50 MB." }, { status: 400 });
    if (!isExamAttemptPdfFile(file)) return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });

    const existing = await loadAttempt(service, attemptId, studentId);
    if (!existing) return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });
    if (isAttemptSubmitted(existing.status)) {
      return NextResponse.json({ error: "This attempt is already submitted." }, { status: 400 });
    }
    if (existing[`${kindValue}_url`] && (kindValue === "marked_script" || kindValue === "marked_script_p2" || kindValue === "marked_script_p3")) {
      return NextResponse.json({ error: "This paper is already uploaded. You can only submit each exam script once." }, { status: 400 });
    }

    const stamp = Date.now();
    const kind = kindValue as ExamAttemptFileKind;
    const path = examAttemptFileStoragePath({
      userId: studentId,
      attemptId,
      kind,
      fileName: file.name,
      stamp,
    });
    const uploaded = await service.storage.from("course-pdfs").upload(path, Buffer.from(await file.arrayBuffer()), {
      upsert: false,
      contentType: "application/pdf",
    });
    if (uploaded.error) return NextResponse.json({ error: uploaded.error.message || "Could not upload that PDF." }, { status: 400 });
    const { data: publicFile } = service.storage.from("course-pdfs").getPublicUrl(path);
    if (!publicFile?.publicUrl) return NextResponse.json({ error: "Could not get a URL for that file." }, { status: 400 });

    const pageImages = { ...existing.page_images };
    const stored: ExamAttemptPageImage[] = [];
    for (const [key, value] of form.entries()) {
      const match = /^page_(\d+)$/.exec(key);
      if (!match || !(value instanceof File) || !value.size) continue;
      const page = Number(match[1]);
      const pagePath = examAttemptPageStoragePath({ userId: studentId, attemptId, kind, page, stamp });
      const pageUpload = await service.storage.from("course-pdfs").upload(pagePath, Buffer.from(await value.arrayBuffer()), {
        upsert: false,
        contentType: "image/jpeg",
      });
      if (pageUpload.error) continue;
      const { data: pageUrl } = service.storage.from("course-pdfs").getPublicUrl(pagePath);
      if (pageUrl?.publicUrl) stored.push({ page, path: pagePath, url: pageUrl.publicUrl });
    }
    if (stored.length) pageImages[kind] = stored.sort((a, b) => a.page - b.page);

    const patch: Record<string, unknown> = {
      [`${kind}_path`]: path,
      [`${kind}_url`]: publicFile.publicUrl,
      [`${kind}_name`]: file.name,
      page_images: pageImages,
      updated_at: new Date().toISOString(),
    };
    const nextDraft = examAttemptFromRow({ ...existing, ...patch });
    patch.status = deriveAttemptStatus({ ...nextDraft, status: "started" });
    const { data, error } = await service.from("exam_attempts").update(patch).eq("id", attemptId).eq("user_id", studentId).select("*").maybeSingle();
    if (error || !data) return NextResponse.json({ error: error?.message || "Could not attach that file." }, { status: 400 });
    return NextResponse.json({ ok: true, attempt: examAttemptFromRow(data as AttemptRow) });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    studentId?: string;
    sittingId?: string;
    attemptId?: string;
  };
  const studentId = String(body.studentId || "");
  if (!isUserId(studentId)) return NextResponse.json({ error: "Choose a student." }, { status: 400 });

  if (body.action === "create") {
    const created = await createExamAttempt({
      userId: studentId,
      sittingId: String(body.sittingId || ""),
      source: STUDENT_ATTEMPT_SOURCE,
      client: service,
    });
    if (created.ok === false) return NextResponse.json({ error: created.error }, { status: 400 });
    return NextResponse.json({ ok: true, attempt: created.attempt });
  }

  if (body.action === "submit") {
    const attemptId = String(body.attemptId || "");
    if (!isUserId(attemptId)) return NextResponse.json({ error: "Missing exam attempt." }, { status: 400 });
    const attempt = await loadAttempt(service, attemptId, studentId);
    if (!attempt) return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });
    if (!isAttemptSubmitted(attempt.status)) {
      if (!attemptHasAllRequiredFiles(attempt)) {
        return NextResponse.json(
          { error: "Upload the completed BMCR worksheet, Paper 1, Paper 2, Paper 3, and the marking report first." },
          { status: 400 }
        );
      }
      const now = new Date().toISOString();
      const { error } = await service
        .from("exam_attempts")
        .update({ status: "analysing", submitted_at: now, updated_at: now })
        .eq("id", attemptId)
        .eq("user_id", studentId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const existingJobs = await jobsForAttempt(attemptId).catch(() => []);
    if (existingJobs.length) return NextResponse.json({ ok: true, attempt, alreadySubmitted: true });

    const useNewEvaluator = newEvaluatorApplies({
      mode: await getEvaluatorMode(),
      sittingReady: isEvaluatorReadySitting(attempt.sitting_id),
      wholeSitting: Boolean(attempt.marked_script_p2_path || attempt.marked_script_p3_path),
      staffTest: false,
    });
    const origin = new URL(request.url).origin;
    if (useNewEvaluator) {
      after(async () => {
        void prepareExamAttemptEvidence(attemptId);
        try {
          const jobs = await createJobsForAttempt(attempt, origin);
          await Promise.all(jobs.filter((job) => job.status !== "done").map((job) => kickJob(job, origin)));
        } catch {
          /* Status page restarts stalled jobs. */
        }
      });
      return NextResponse.json({ ok: true, status: "analysing", evaluator: "v2" });
    }
    after(() => {
      void prepareExamAttemptEvidence(attemptId);
      if (attempt.marked_script_url && !attempt.evaluation_id) {
        void requestScriptEvaluation({
          fileUrl: attempt.marked_script_url,
          paperName: attemptPaperName(attempt),
          userId: studentId,
          attemptId,
          pageImageUrls: (attempt.page_images.marked_script || []).map((page) => page.url).filter(Boolean),
          origin,
          cookie: request.headers.get("cookie") || "",
        });
      }
    });
    return NextResponse.json({ ok: true, status: "analysing" });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}
