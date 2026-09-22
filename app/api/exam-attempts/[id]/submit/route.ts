import { after, NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { prepareExamAttemptEvidence } from "@/lib/exam-attempt-evidence";
import {
  attemptFileCount,
  examAttemptFromRow,
  isAttemptSubmitted,
  isMissingExamAttemptsTable,
} from "@/lib/exam-attempts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase is not configured." }, { status: 500 });
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const { id } = await context.params;
  const { data, error } = await supabase
    .from("exam_attempts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      {
        error: isMissingExamAttemptsTable(error.message)
          ? "Paste supabase/exam-attempts.sql in the Supabase SQL editor, then try again."
          : error.message,
      },
      { status: 400 }
    );
  }
  if (!data) return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });

  const attempt = examAttemptFromRow(data as Record<string, unknown>);
  if (!isAttemptSubmitted(attempt.status)) {
    if (attemptFileCount(attempt) < 3) {
      return NextResponse.json(
        { error: "Upload the completed BMCR worksheet, marked script, and marking report first." },
        { status: 400 }
      );
    }
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("exam_attempts")
      .update({ status: "analysing", submitted_at: now, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  after(() => {
    void prepareExamAttemptEvidence(id);
  });

  return NextResponse.json({ ok: true, status: "analysing" });
}
