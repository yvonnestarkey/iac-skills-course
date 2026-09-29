import { NextResponse } from "next/server";
import { extractExamAttemptId, getEvaluatorAttemptEvidence } from "@/lib/exam-evaluator-evidence";
import { peekRequestBody, recordActionRequest, requestMeta, responseSummary } from "@/lib/mindset-action-request-log";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function attemptIdFrom(request: Request, peeked: unknown): string {
  const url = new URL(request.url);
  return (
    extractExamAttemptId(url.searchParams.get("attempt_id") || url.searchParams.get("attemptId") || url.searchParams.get("id")) ||
    extractExamAttemptId(peeked)
  );
}

async function readEvidence(request: Request, peeked: unknown) {
  const attemptId = attemptIdFrom(request, peeked);
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
  const response = await readEvidence(request, body);
  const payload = await response.clone().json().catch(() => null);
  void recordActionRequest({
    route: "evaluator-evidence",
    ...requestMeta(request),
    body,
    status: response.status,
    ...responseSummary(response, payload),
  });
  return withActionHeaders(response);
}

function withActionHeaders(response: NextResponse) {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, OpenAI-Conversation-ID, OpenAI-Ephemeral-User-ID");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

export async function OPTIONS(request: Request) {
  void recordActionRequest({
    route: "evaluator-evidence",
    ...requestMeta(request),
    body: await peekRequestBody(request),
    status: 204,
    response_content_type: null,
    response_bytes: 0,
    response_error: null,
  });
  return withActionHeaders(
    new NextResponse(null, { status: 204, headers: { Allow: "GET, HEAD, OPTIONS, POST" } })
  );
}
