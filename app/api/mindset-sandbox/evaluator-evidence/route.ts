import { NextResponse } from "next/server";
import { getEvaluatorAttemptEvidence } from "@/lib/exam-evaluator-evidence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const attemptId = new URL(request.url).searchParams.get("attempt_id") || "";
  if (!attemptId.trim()) {
    return NextResponse.json({ error: "Missing attempt_id." }, { status: 400 });
  }

  try {
    const evidence = await getEvaluatorAttemptEvidence(attemptId.trim());
    if (!evidence) {
      return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });
    }
    return NextResponse.json(evidence);
  } catch (error) {
    console.error("getEvaluatorAttemptEvidence", error);
    return NextResponse.json({ error: "Could not load evaluator evidence." }, { status: 500 });
  }
}
