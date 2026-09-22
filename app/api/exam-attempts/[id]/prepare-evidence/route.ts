import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prepareExamAttemptEvidence } from "@/lib/exam-attempt-evidence";
import { examAttemptFromRow, isMissingExamAttemptsTable } from "@/lib/exam-attempts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function studentClient(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });
}

async function ownAttempt(request: NextRequest, attemptId: string) {
  const supabase = await studentClient(request);
  if (!supabase) return { error: "Supabase is not configured.", status: 500 as const };
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required.", status: 401 as const };
  const { data, error } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (error) {
    return {
      error: isMissingExamAttemptsTable(error.message)
        ? "Paste supabase/exam-attempts.sql in the Supabase SQL editor, then try again."
        : error.message,
      status: 400 as const,
    };
  }
  if (!data) return { error: "That exam attempt was not found.", status: 404 as const };
  return { user, attempt: examAttemptFromRow(data as Record<string, unknown>) };
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const owned = await ownAttempt(request, id);
  if (!("attempt" in owned) || !owned.attempt) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }

  const result = await prepareExamAttemptEvidence(owned.attempt.id);
  if (result.ok === false) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    status: result.attempt.status,
    evidence_pack: result.pack,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const owned = await ownAttempt(request, id);
  if (!("attempt" in owned) || !owned.attempt) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  return NextResponse.json({
    ok: true,
    status: owned.attempt.status,
    evidence_pack: owned.attempt.evidence_pack,
  });
}
