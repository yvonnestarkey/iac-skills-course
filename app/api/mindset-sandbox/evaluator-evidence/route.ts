import { NextResponse } from "next/server";
import { getEvaluatorAttemptEvidence } from "@/lib/exam-evaluator-evidence";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function attemptIdFrom(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("attempt_id") || url.searchParams.get("attemptId") || "";
  if (fromQuery.trim()) return fromQuery.trim();
  const body = (await request.json().catch(() => null)) as { [key: string]: unknown } | null;
  if (!body || typeof body !== "object") return "";
  const value = body.attempt_id || body.attemptId || body.id;
  return String(value || "").trim();
}

async function readEvidence(request: Request) {
  const attemptId = await attemptIdFrom(request);
  if (!attemptId) {
    return NextResponse.json({ error: "Missing attempt_id." }, { status: 400 });
  }

  try {
    const evidence = await getEvaluatorAttemptEvidence(attemptId);
    if (!evidence) {
      return NextResponse.json({ error: "That exam attempt was not found." }, { status: 404 });
    }
    return NextResponse.json(evidence);
  } catch (error) {
    console.error("getEvaluatorAttemptEvidence", error);
    return NextResponse.json({ error: "Could not load evaluator evidence." }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return readEvidence(request);
}

export async function POST(request: Request) {
  return readEvidence(request);
}
