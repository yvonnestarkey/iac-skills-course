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

function pluginJson(body: unknown, status = 200) {
  const encoded = JSON.stringify(body);
  return new NextResponse(encoded, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(encoded)),
    },
  });
}

async function readEvidence(request: Request, peeked: unknown) {
  const attemptId = attemptIdFrom(request, peeked);
  if (!attemptId) {
    return pluginJson({ error: "Missing attempt_id." }, 400);
  }

  try {
    const evidence = await getEvaluatorAttemptEvidence(attemptId);
    if (!evidence) {
      return pluginJson({ error: "That exam attempt was not found." }, 404);
    }
    return pluginJson(evidence);
  } catch (error) {
    console.error("getEvaluatorAttemptEvidence", error);
    return pluginJson({ error: "Could not load evaluator evidence." }, 500);
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
  return withPluginHeaders(request, response);
}

function withPluginHeaders(request: Request, response: NextResponse) {
  const origin = request.headers.get("origin");
  response.headers.set("Access-Control-Allow-Origin", origin && origin !== "null" ? origin : "*");
  response.headers.set("Vary", "Origin, Access-Control-Request-Headers");
  response.headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS, POST");
  response.headers.set(
    "Access-Control-Allow-Headers",
    request.headers.get("access-control-request-headers") ||
      "Content-Type, Authorization, OpenAI-Conversation-ID, OpenAI-Ephemeral-User-ID"
  );
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
  response.headers.set("CDN-Cache-Control", "no-store");
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
  return withPluginHeaders(
    request,
    new NextResponse(null, { status: 204, headers: { Allow: "GET, HEAD, OPTIONS, POST" } })
  );
}
