import { after, NextResponse } from "next/server";
import { getRequestUser, isStaffUser } from "@/lib/auth-server";
import { prepareExamAttemptEvidence } from "@/lib/exam-attempt-evidence";
import {
  attemptHasAnyUploadedFile,
  attemptPaperName,
  createExamAttempt,
  deriveAttemptStatus,
  EXAM_ATTEMPT_MARKING_REPORT_2_SQL,
  examAttemptFileStoragePath,
  examAttemptFromRow,
  isAttemptSubmitted,
  isExamAttemptFileKind,
  isExamAttemptOwnedStoragePath,
  isExamAttemptPdfFile,
  requestScriptEvaluation,
  type ExamAttempt,
  type ExamAttemptFileKind,
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

type Service = NonNullable<ReturnType<typeof getServiceSupabase>>;

async function loadAttempt(service: Service, attemptId: string, studentId: string): Promise<ExamAttempt | null> {
  const { data } = await service.from("exam_attempts").select("*").eq("id", attemptId).eq("user_id", studentId).maybeSingle();
  return data ? examAttemptFromRow(data as AttemptRow) : null;
}

async function openAttempt(
  service: Service,
  studentId: string,
  attemptId: string,
  kind: ExamAttemptFileKind
): Promise<{ attempt: ExamAttempt } | { error: string; status: number }> {
  const existing = await loadAttempt(service, attemptId, studentId);
  if (!existing) return { error: "That exam attempt was not found.", status: 404 };
  if (isAttemptSubmitted(existing.status)) return { error: "This attempt is already submitted.", status: 400 };
  if (existing[`${kind}_url`] && (kind === "marked_script" || kind === "marked_script_p2" || kind === "marked_script_p3")) {
    return { error: "This paper is already uploaded. You can only submit each exam script once.", status: 400 };
  }
  return { attempt: existing };
}

async function attachStoredFile(
  service: Service,
  existing: ExamAttempt,
  studentId: string,
  attemptId: string,
  kind: ExamAttemptFileKind,
  path: string,
  fileName: string
) {
  const { data: publicFile } = service.storage.from("course-pdfs").getPublicUrl(path);
  if (!publicFile?.publicUrl) return NextResponse.json({ error: "Could not get a URL for that file." }, { status: 400 });
  const patch: Record<string, unknown> = {
    [`${kind}_path`]: path,
    [`${kind}_url`]: publicFile.publicUrl,
    [`${kind}_name`]: fileName,
    updated_at: new Date().toISOString(),
  };
  const nextDraft = examAttemptFromRow({ ...existing, ...patch });
  patch.status = deriveAttemptStatus({ ...nextDraft, status: "started" });
  const { data, error } = await service.from("exam_attempts").update(patch).eq("id", attemptId).eq("user_id", studentId).select("*").maybeSingle();
  if (error || !data) {
    if (error && /marking_report_2/i.test(error.message)) {
      return NextResponse.json({ error: EXAM_ATTEMPT_MARKING_REPORT_2_SQL }, { status: 400 });
    }
    return NextResponse.json({ error: error?.message || "Could not attach that file." }, { status: 400 });
  }
  return NextResponse.json({ ok: true, attempt: examAttemptFromRow(data as AttemptRow) });
}

export async function POST(request: Request) {
  const actor = await getRequestUser();
  if (!isStaffUser(actor)) return NextResponse.json({ error: "Coach access required." }, { status: 403 });
  const service = getServiceSupabase();
  if (!service) return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    studentId?: string;
    sittingId?: string;
    attemptId?: string;
    kind?: string;
    fileName?: string;
    path?: string;
  };
  const studentId = String(body.studentId || "");
  if (!isUserId(studentId)) return NextResponse.json({ error: "Choose a student." }, { status: 400 });

  if (body.action === "sign-upload" || body.action === "attach") {
    const attemptId = String(body.attemptId || "");
    const kindValue = String(body.kind || "");
    const fileName = String(body.fileName || "").trim();
    if (!isUserId(attemptId) || !isExamAttemptFileKind(kindValue)) {
      return NextResponse.json({ error: "Choose the student, attempt, and which PDF this is." }, { status: 400 });
    }
    if (!isExamAttemptPdfFile({ type: "application/pdf", name: fileName || "file.pdf", size: 1 })) {
      return NextResponse.json({ error: "Please upload a PDF file." }, { status: 400 });
    }
    const opened = await openAttempt(service, studentId, attemptId, kindValue);
    if ("error" in opened) return NextResponse.json({ error: opened.error }, { status: opened.status });

    if (body.action === "sign-upload") {
      const path = examAttemptFileStoragePath({
        userId: studentId,
        attemptId,
        kind: kindValue,
        fileName: fileName || `${kindValue}.pdf`,
      });
      const signed = await service.storage.from("course-pdfs").createSignedUploadUrl(path);
      if (signed.error || !signed.data?.signedUrl || !signed.data.token) {
        return NextResponse.json({ error: signed.error?.message || "Could not start that PDF upload." }, { status: 400 });
      }
      return NextResponse.json({
        ok: true,
        path: signed.data.path || path,
        token: signed.data.token,
        signedUrl: signed.data.signedUrl,
      });
    }

    const path = String(body.path || "");
    if (!isExamAttemptOwnedStoragePath(path, studentId, attemptId, kindValue)) {
      return NextResponse.json({ error: "That file does not belong to this attempt." }, { status: 400 });
    }
    return attachStoredFile(service, opened.attempt, studentId, attemptId, kindValue, path, fileName || `${kindValue}.pdf`);
  }

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
      if (!attemptHasAnyUploadedFile(attempt)) {
        return NextResponse.json({ error: "Upload at least one PDF first." }, { status: 400 });
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
