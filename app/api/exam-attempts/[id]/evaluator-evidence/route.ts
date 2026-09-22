import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getEvaluatorAttemptEvidence } from "@/lib/exam-evaluator-evidence";
import { isCoachAccount } from "@/lib/roles";
import { studentUserFromAuth } from "@/lib/student-lesson";

export const dynamic = "force-dynamic";

export async function GET(
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
  const evidence = await getEvaluatorAttemptEvidence(id);
  if (!evidence) {
    return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });
  }

  const coach = isCoachAccount(studentUserFromAuth(user));
  if (!coach && evidence.attempt.user_id !== user.id) {
    return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    analysed: false,
    evidence,
  });
}
