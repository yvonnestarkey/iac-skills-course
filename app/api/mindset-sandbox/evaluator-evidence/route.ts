import { NextResponse } from "next/server";
import { getEvaluatorAttemptEvidence } from "@/lib/exam-evaluator-evidence";
import { peekRequestBody, recordActionRequest, requestMeta, responseSummary } from "@/lib/mindset-action-request-log";

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

async function handle(request: Request) {
  const body = await peekRequestBody(request);
  const response = await readEvidence(request);
  const payload = await response.clone().json().catch(() => null);
  await recordActionRequest({
    route: "evaluator-evidence",
    ...requestMeta(request),
    body,
    status: response.status,
    ...responseSummary(response, payload),
  });
  return response;
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function OPTIONS(request: Request) {
  await recordActionRequest({
    route: "evaluator-evidence",
    ...requestMeta(request),
    body: await peekRequestBody(request),
    status: 204,
    response_content_type: null,
    response_bytes: 0,
    response_error: null,
  });
  return new NextResponse(null, { status: 204, headers: { Allow: "GET, HEAD, OPTIONS, POST" } });
}
